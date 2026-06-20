import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { visionRateLimiter } from "@/lib/rateLimiter";

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

export async function POST(req: NextRequest): Promise<NextResponse<VisionResponseBody>> {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    if (!imageBase64) {
      return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
    }

    // Shared throttle across every open session. When the global window is full
    // we tell the client to back off rather than letting Google issue a hard 429.
    if (!visionRateLimiter.tryAcquire()) {
      const retryAfterSec = Math.max(1, Math.ceil(visionRateLimiter.retryAfterMs() / 1000));
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

    return NextResponse.json({
      result: text.length > 0 ? text : "[NO SIGNAL]",
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
    });
  } catch (error) {
    console.error("[ARIA] vision route error:", error);
    return NextResponse.json({ result: "[SIGNAL LOST]", inputTokens: 0, outputTokens: 0 });
  }
}
