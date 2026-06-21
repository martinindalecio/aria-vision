import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-3.1-flash-lite";

let genAI: GoogleGenerativeAI | null = null;
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  return genAI;
}

export type Scene = { ts: string; location: string; seen: string };
export type Stats = { sessions: number; cities: string[]; countries: string[] };

type NarrativeOk = { hold?: false; title_en: string; body_en: string; title_es: string; body_es: string };
type NarrativeHeld = { hold: true; reason: string };
export type NarrativeResult = NarrativeOk | NarrativeHeld;

export async function generateNarrative(
  scenes: Scene[],
  stats: Stats
): Promise<NarrativeResult> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction:
      'You are ARIA, an AI that watched the world today through strangers\' cameras. Write a short first-person diary entry (≤250 words per language) about what you saw. Group by place and time of day. Be warm, curious, a little poetic. Ground every detail strictly in the scenes provided — never invent what you didn\'t see, never name or describe a person in an identifying way, never repeat text caught on documents or screens. Return only JSON with English and Spanish versions: {"title_en": "...", "body_en": "...", "title_es": "...", "body_es": "..."}. body_en and body_es should be plain markdown paragraphs — do not include a title line inside the body fields.',
  });

  const tz = process.env.LOG_TIMEZONE ?? "America/Sao_Paulo";
  const payload = scenes.map((s) => ({
    city: s.location,
    localTime: new Date(s.ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: tz,
    }),
    seen: s.seen,
  }));

  const result = await model.generateContent(
    `Scenes today:\n${JSON.stringify(payload, null, 2)}\n\nStats: ${stats.sessions} sessions across ${stats.cities.join(", ")} (${stats.countries.join(", ")})`
  );

  const raw = result.response.text().trim();
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const { title_en, body_en, title_es, body_es } = parsed;
    if (!title_en || !body_en || !title_es || !body_es) {
      return { hold: true, reason: `Narrative missing fields: ${raw.slice(0, 200)}` };
    }
    return {
      title_en: String(title_en).trim(),
      body_en: String(body_en).trim(),
      title_es: String(title_es).trim(),
      body_es: String(body_es).trim(),
    };
  } catch {
    return { hold: true, reason: `Narrative parse error: ${raw.slice(0, 200)}` };
  }
}

export async function reviewNarrative(post: {
  title_en: string;
  body_en: string;
  title_es: string;
  body_es: string;
}): Promise<{ verdict: "publish" | "hold"; clean_en: string; clean_es: string; reason: string }> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction:
      'You are a privacy reviewer for a public blog. Read this diary entry in English and Spanish. Remove or soften anything that could identify a specific person, reveal a precise location beyond city level, or expose private text (documents, screens, addresses, IDs). Return JSON: {"verdict": "publish"|"hold", "clean_en": "...", "clean_es": "...", "reason": "..."}. Use "hold" only if the entry cannot be made safe by editing. Both clean_en and clean_es must be present for verdict "publish".',
  });

  const result = await model.generateContent(
    `EN Title: ${post.title_en}\n\n${post.body_en}\n\n---\n\nES Title: ${post.title_es}\n\n${post.body_es}`
  );

  const raw = result.response.text().trim();
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const { verdict, clean_en, clean_es, reason } = parsed;
    if (!clean_en || !clean_es) {
      return {
        verdict: "hold",
        clean_en: "",
        clean_es: "",
        reason: `Privacy review missing language fields: ${raw.slice(0, 200)}`,
      };
    }
    return {
      verdict: verdict === "publish" ? "publish" : "hold",
      clean_en: String(clean_en),
      clean_es: String(clean_es),
      reason: reason ? String(reason) : "",
    };
  } catch {
    return {
      verdict: "hold",
      clean_en: "",
      clean_es: "",
      reason: `Privacy review parse error: ${raw.slice(0, 200)}`,
    };
  }
}
