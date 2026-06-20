import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { waitUntil } from "@vercel/functions";
import { visionRateLimiter } from "@/lib/rateLimiter";
import kv from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemini-3.1-flash-lite";
const MAX_TOKENS = 80;

type VisionRequestBody = {
  imageBase64?: string;
  prevContext?: string;
};

type VisionResponseBody = {
  result: string;
  inputTokens: number;
  outputTokens: number;
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

// Minimal request logging: one structured line per request to the runtime logs
// (read with: `vercel logs <deployment> | grep ARIA-LOG`). Records the outcome,
// the scene description the model returned ("what was seen"), and coarse
// IP-based location from Vercel's edge headers. No image is stored and no
// precise geolocation is requested (that would need a browser consent prompt).
type Outcome = "ok" | "no_signal" | "throttled" | "signal_lost" | "empty_input";
function logOutcome(
  req: NextRequest,
  outcome: Outcome,
  extra: { seen?: string; outputTokens?: number; error?: string } = {}
): void {
  const decode = (v: string | null): string | undefined => {
    if (!v) return undefined;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const location =
    [
      decode(req.headers.get("x-vercel-ip-city")),
      decode(req.headers.get("x-vercel-ip-country-region")),
      decode(req.headers.get("x-vercel-ip-country")),
    ]
      .filter(Boolean)
      .join(", ") || "unknown";
  console.log(
    "[ARIA-LOG] " +
      JSON.stringify({ ts: new Date().toISOString(), outcome, location, ...extra })
  );
}

export async function POST(req: NextRequest): Promise<NextResponse<VisionResponseBody>> {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    if (!imageBase64) {
      logOutcome(req, "empty_input");
      return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
    }

    // Shared throttle across every open session. When the global window is full
    // we tell the client to back off rather than letting Google issue a hard 429.
    if (!visionRateLimiter.tryAcquire()) {
      const retryAfterSec = Math.max(1, Math.ceil(visionRateLimiter.retryAfterMs() / 1000));
      logOutcome(req, "throttled");
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
    logOutcome(req, outcome, { seen: result, outputTokens });

    if (outcome === "ok") {
      const decode = (v: string | null): string => {
        if (!v) return "";
        try { return decodeURIComponent(v); } catch { return v; }
      };
      const location =
        [
          decode(req.headers.get("x-vercel-ip-country-region")),
          decode(req.headers.get("x-vercel-ip-country")),
        ]
          .filter(Boolean)
          .join(", ") || "unknown";
      const tz = process.env.LOG_TIMEZONE ?? "Europe/Madrid";
      const dateKey = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date());
      const scene = JSON.stringify({ ts: new Date().toISOString(), location, seen: result });
      waitUntil(
        (async () => {
          const key = `aria:scenes:${dateKey}`;
          await kv.rpush(key, scene);
          await kv.expire(key, 259200); // 3-day TTL
        })().catch(() => {})
      );
    }

    return NextResponse.json({
      result,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens,
    });
  } catch (error) {
    console.error("[ARIA] vision route error:", error);
    logOutcome(req, "signal_lost", {
      error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
  }
}
