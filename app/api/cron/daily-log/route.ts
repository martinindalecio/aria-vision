import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { generateNarrative, reviewNarrative, type Scene, type Stats } from "@/lib/narrative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getYesterdayKey(): string {
  const tz = process.env.LOG_TIMEZONE ?? "Europe/Madrid";
  const now = new Date();
  const todayLocal = new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(now);
  const todayMs = new Date(todayLocal).getTime();
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;
  return new Date(yesterdayMs).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const override = new URL(req.url).searchParams.get("date");
  const dateKey = override ?? getYesterdayKey();

  // Step 1: fetch yesterday's scenes
  const raw = await kv.lrange<Scene>(`aria:scenes:${dateKey}`, 0, -1);
  const scenes: Scene[] = Array.isArray(raw) ? raw : [];

  // Step 2: skip if no scenes
  if (scenes.length === 0) {
    return NextResponse.json({ message: `no scenes for ${dateKey}` });
  }

  // Step 3: compute stats
  const cities = [
    ...new Set(
      scenes
        .map((s) => s.location.split(", ")[0])
        .filter((c) => c && c !== "unknown")
    ),
  ];
  const countries = [
    ...new Set(
      scenes
        .map((s) => {
          const parts = s.location.split(", ");
          return parts[parts.length - 1];
        })
        .filter((c) => c && c !== "unknown")
    ),
  ];
  const stats: Stats = { sessions: scenes.length, cities, countries };

  // Step 4: generate narrative
  const { title, body_md } = await generateNarrative(scenes, stats);

  // Step 5: privacy review
  const review = await reviewNarrative({ title, body_md });

  if (review.verdict === "hold") {
    await kv.set(`aria:held:${dateKey}`, {
      title,
      body_md: review.clean_body || body_md,
      reason: review.reason,
    });
    return NextResponse.json({ message: `held: ${review.reason}`, dateKey });
  }

  // Step 6: publish
  const post = {
    title,
    body_md: review.clean_body || body_md,
    stats,
    published_at: new Date().toISOString(),
  };
  const score = Number(dateKey.replace(/-/g, ""));
  await kv.set(`aria:post:${dateKey}`, post);
  await kv.zadd("aria:posts", { score, member: dateKey });

  return NextResponse.json({ message: "published", dateKey, title });
}
