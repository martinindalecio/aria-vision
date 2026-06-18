import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 80;

type VisionRequestBody = {
  imageBase64?: string;
  prevContext?: string;
};

type VisionResponseBody = {
  result: string;
  inputTokens: number;
  outputTokens: number;
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

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client === null) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export async function POST(req: NextRequest): Promise<NextResponse<VisionResponseBody>> {
  try {
    const body = (await req.json()) as VisionRequestBody;
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    if (!imageBase64) {
      return NextResponse.json({
        result: "[SIGNAL LOST]",
        inputTokens: 0,
        outputTokens: 0,
      });
    }

    const prevContext =
      typeof body.prevContext === "string" && body.prevContext.length > 0
        ? body.prevContext
        : "none. This is the first frame.";

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: getSystemPrompt(),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "[PREV_CONTEXT]: " + prevContext,
            },
          ],
        },
      ],
    });

    const result = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    const usage = response.usage;
    const inputTokens =
      usage.input_tokens +
      (usage.cache_read_input_tokens ?? 0) +
      (usage.cache_creation_input_tokens ?? 0);

    return NextResponse.json({
      result: result.length > 0 ? result : "[NO SIGNAL]",
      inputTokens,
      outputTokens: usage.output_tokens,
    });
  } catch (error) {
    console.error("[ARIA] vision route error:", error);
    return NextResponse.json({
      result: "[SIGNAL LOST]",
      inputTokens: 0,
      outputTokens: 0,
    });
  }
}
