import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-2.0-flash";

let genAI: GoogleGenerativeAI | null = null;
function getClient() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  return genAI;
}

export type Scene = { ts: string; location: string; seen: string };
export type Stats = { sessions: number; cities: string[]; countries: string[] };

export async function generateNarrative(
  scenes: Scene[],
  stats: Stats
): Promise<{ title: string; body_md: string }> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction:
      "You are ARIA, an AI that watched the world today through strangers' cameras. Write a short first-person diary entry (≤250 words) about what you saw. Group by place and time of day. Be warm, curious, a little poetic. Ground every detail strictly in the scenes provided — never invent what you didn't see, never name or describe a person in an identifying way, never repeat text caught on documents or screens. Output a title line (starting with '# ') then the body in markdown.",
  });

  const payload = scenes.map((s) => ({
    city: s.location,
    localTime: new Date(s.ts).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    seen: s.seen,
  }));

  const result = await model.generateContent(
    `Scenes today:\n${JSON.stringify(payload, null, 2)}\n\nStats: ${stats.sessions} sessions across ${stats.cities.join(", ")} (${stats.countries.join(", ")})`
  );

  const text = result.response.text().trim();
  // Accept "# Title" or "Title: ..." as the title line
  const titleMatch =
    text.match(/^#\s+(.+)$/m) ?? text.match(/^Title:\s+(.+)$/im);
  const title = titleMatch?.[1]?.trim() ?? "ARIA Daily Log";
  const titleLine = titleMatch?.[0] ?? "";
  const bodyStart = titleLine
    ? text.indexOf(titleLine) + titleLine.length
    : 0;
  const body_md = text.slice(bodyStart).replace(/^Title:\s+.+\n*/im, "").trim();

  return { title, body_md };
}

export async function reviewNarrative(post: {
  title: string;
  body_md: string;
}): Promise<{ verdict: "publish" | "hold"; clean_body: string; reason: string }> {
  const model = getClient().getGenerativeModel({
    model: MODEL,
    systemInstruction:
      'You are a privacy reviewer for a public blog. Read this diary entry. Remove or soften anything that could identify a specific person, reveal a precise location beyond city level, or expose private text (documents, screens, addresses, IDs). Return JSON: {"verdict": "publish"|"hold", "clean_body": "...", "reason": "..."}. Use "hold" only if the entry cannot be made safe by editing.',
  });

  const result = await model.generateContent(
    `Title: ${post.title}\n\n${post.body_md}`
  );

  const raw = result.response.text().trim();
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    return JSON.parse(json);
  } catch {
    return {
      verdict: "hold",
      clean_body: "",
      reason: `Privacy review parse error: ${raw.slice(0, 200)}`,
    };
  }
}
