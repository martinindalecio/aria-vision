import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { visionRateLimiter } from "@/lib/rateLimiter";
import kv from "@/lib/kv";
import { countryOnlyFromHeaders } from "@/lib/location";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-3.1-flash-lite";
const MAX_TOKENS = 200;

type GeoBody = { city?: string; region?: string; country?: string };

type VisionRequestBody = {
  imageBase64?: string;
  prevContext?: string;
  geo?: GeoBody;
};

type VisionResponseBody = {
  result: string;
  description_es?: string;
  inputTokens: number;
  outputTokens: number;
  sceneCount?: number;
  throttled?: boolean;
};

let cachedSystemPrompt: string | null = null;

function getSystemPrompt(): string {
  if (cachedSystemPrompt === null) {
    cachedSystemPrompt = fs.readFileSync(
      path.join(process.cwd(), "prompts", "system.md"),
      "utf-8"
    );
  }
  return cachedSystemPrompt;
}

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (genAI === null) {
    genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  }
  return genAI;
}

type Outcome = "ok" | "no_signal" | "throttled" | "signal_lost" | "empty_input";

function sanitizeGeo(s: string | undefined): string {
  if (!s) return "";
  return s.trim().replace(/,/g, "").slice(0, 60);
}

// GPS names take priority; falls back to IP country code only (reliable on mobile).
// IP city/region are intentionally dropped — carrier PoPs scatter city-level IP
// geo across unrelated cities for cellular users.
function resolveLocation(req: NextRequest, geo?: GeoBody): string {
  if (geo?.country) {
    const city = sanitizeGeo(geo.city);
    const region = sanitizeGeo(geo.region);
    const country = sanitizeGeo(geo.country);
    return [city, region, country].filter(Boolean).join(", ");
  }
  return countryOnlyFromHeaders((k) => req.headers.get(k));
}

function logOutcome(
  outcome: Outcome,
  location: string,
  extra: { seen?: string; outputTokens?: number; error?: string } = {}
): void {
  console.log(
    "[ARIA-LOG] " +
      JSON.stringify({ ts: new Date().toISOString(), outcome, location, ...extra })
  );
}

export async function POST(req: NextRequest): Promise<NextResponse<VisionResponseBody>> {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const location = resolveLocation(req, body.geo);

    if (!imageBase64) {
      logOutcome("empty_input", location);
      return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
    }

    // Shared throttle across every open session. When the global window is full
    // we tell the client to back off rather than letting Google issue a hard 429.
    if (!visionRateLimiter.tryAcquire()) {
      const retryAfterSec = Math.max(1, Math.ceil(visionRateLimiter.retryAfterMs() / 1000));
      logOutcome("throttled", location);
      return NextResponse.json(
        { result: "[ARIA THROTTLED — QUEUED]", inputTokens: 0, outputTokens: 0, throttled: true },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const prevContext =
      typeof body.prevContext === "string" && body.prevContext.length > 0
        ? body.prevContext
        : "none. This is the first frame.";

    const model = getClient().getGenerativeModel({
      model: MODEL,
      systemInstruction: getSystemPrompt(),
      generationConfig: { maxOutputTokens: MAX_TOKENS },
    });

    const geminiResult = await model.generateContent([
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
      "[PREV_CONTEXT]: " + prevContext,
    ]);

    const text = geminiResult.response.text().trim();
    const usage = geminiResult.response.usageMetadata;
    const result = text.length > 0 ? text : "[NO SIGNAL]";
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    const outcome: Outcome = text.length > 0 ? "ok" : "no_signal";
    logOutcome(outcome, location, { seen: result, outputTokens });

    let sceneCount: number | undefined;
    if (outcome === "ok") {
      const tz = process.env.LOG_TIMEZONE ?? "America/Los_Angeles";
      const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date());
      const scene = JSON.stringify({ ts: new Date().toISOString(), location, seen: result });
      try {
        const key = `aria:scenes:${dateKey}`;
        sceneCount = await kv.rpush(key, scene);
        await kv.expire(key, 259200); // 3-day TTL
      } catch {
        // KV failure — scene not stored but vision result still returned
      }
    }

    return NextResponse.json({
      result,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens,
      sceneCount,
    });
  } catch (error) {
    console.error("[ARIA] vision route error:", error);
    logOutcome("signal_lost", "unknown", {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
  }
}
