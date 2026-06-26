import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";
import { generateNarrative, reviewNarrative, type Scene, type Stats } from "@/lib/narrative";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getYesterdayKey(): string {
  const tz = process.env.LOG_TIMEZONE ?? "America/Los_Angeles";
  // "Yesterday" in the log timezone: shift back 24h from now, then format that
  // instant in tz. Formatting in tz (instead of parsing a date-only string as
  // UTC midnight and subtracting) keeps the key correct regardless of the
  // server's UTC offset. This trails `now` by one tz-day, so the cron must fire
  // AFTER local midnight (see vercel.json: 09:00 UTC = 01:00 PST / 02:00 PDT)
  // for it to land on the day that just ended, not the day before that.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(yesterday);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const override = new URL(req.url).searchParams.get("date");
  const dateKey = override ?? getYesterdayKey();

  try {
    // Step 1: fetch yesterday's scenes
    const raw = await kv.lrange<Scene>(`aria:scenes:${dateKey}`, 0, -1);
    const scenes: Scene[] = Array.isArray(raw) ? raw : [];

    // Step 2: skip if no scenes
    if (scenes.length === 0) {
      console.warn(`[ARIA-CRON] no scenes for ${dateKey} — nothing to publish`);
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
    const narrative = await generateNarrative(scenes, stats);

    if (narrative.hold) {
      console.warn(`[ARIA-CRON] held ${dateKey} (narrative parse): ${narrative.reason}`);
      await kv.set(`aria:held:${dateKey}`, {
        title: "[NARRATIVE PARSE ERROR]",
        body_md: "",
        reason: narrative.reason,
      });
      return NextResponse.json({ message: `held: ${narrative.reason}`, dateKey });
    }

    const { title_en, body_en, title_es, body_es } = narrative;

    // Step 5: privacy review
    const review = await reviewNarrative({ title_en, body_en, title_es, body_es });

    if (review.verdict === "hold") {
      console.warn(`[ARIA-CRON] held ${dateKey} (privacy review): ${review.reason}`);
      await kv.set(`aria:held:${dateKey}`, {
        title_en,
        title_es,
        body_md_en: review.clean_en || body_en,
        body_md_es: review.clean_es || body_es,
        // backward compat
        title: title_en,
        body_md: review.clean_en || body_en,
        reason: review.reason,
      });
      return NextResponse.json({ message: `held: ${review.reason}`, dateKey });
    }

    // Step 6: publish — strip any stray title echo Gemini may include in body
    const strip = (s: string) =>
      s.trim().replace(/^#+\s+.+\n*/m, "").replace(/^Title:\s+.+\n*/im, "").trim();

    const post = {
      title_en,
      body_md_en: strip(review.clean_en),
      title_es,
      body_md_es: strip(review.clean_es),
      // backward compat for existing log readers
      title: title_en,
      body_md: strip(review.clean_en),
      stats,
      published_at: new Date().toISOString(),
    };
    const score = Number(dateKey.replace(/-/g, ""));
    await kv.set(`aria:post:${dateKey}`, post);
    await kv.zadd("aria:posts", { score, member: dateKey });

    console.log(`[ARIA-CRON] published ${dateKey}: ${title_en}`);
    return NextResponse.json({ message: "published", dateKey, title: title_en });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ARIA-CRON] failed for ${dateKey}:`, msg);
    return NextResponse.json({ error: msg, dateKey }, { status: 500 });
  }
}
