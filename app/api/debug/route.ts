import { NextRequest, NextResponse } from "next/server";
import kv from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Temporary debug endpoint — remove after confirming Redis is working
export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await kv.keys("aria:*");
  const details = await Promise.all(
    keys.map(async (k) => {
      const t = await kv.type(k);
      const len = t === "list" ? await kv.llen(k) : t === "zset" ? await kv.zcard("aria:posts") : null;
      return { key: k, type: t, len };
    })
  );

  return NextResponse.json({ keys: details });
}
