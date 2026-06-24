import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import kv from "@/lib/kv";
import { releaseHeldPost, logoutAdmin } from "./actions";
import type { Scene } from "@/lib/narrative";
import { formatLocation } from "@/lib/location";

export const dynamic = "force-dynamic";

// ---------- types ----------

type Post = {
  title_en?: string;
  title_es?: string;
  title?: string;
  stats: { sessions: number; cities: string[]; countries: string[] };
  published_at: string;
};

type HeldPost = {
  title_en?: string;
  title?: string;
  reason?: string;
};

// ---------- data fetching ----------

function getDateRange(days: number): string[] {
  const tz = process.env.LOG_TIMEZONE ?? "America/Los_Angeles";
  const fmt = new Intl.DateTimeFormat("sv-SE", { timeZone: tz });
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - i * 86_400_000);
    return fmt.format(d);
  });
}

async function getScenes(): Promise<Array<{ date: string; scenes: Scene[] }>> {
  const dates = getDateRange(3);
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const raw = await kv.lrange<Scene>(`aria:scenes:${date}`, 0, -1);
        return { date, scenes: Array.isArray(raw) ? raw : [] };
      } catch {
        return { date, scenes: [] };
      }
    })
  );
  return results.filter((r) => r.scenes.length > 0);
}

async function getHeldPosts(): Promise<Array<{ date: string; post: HeldPost }>> {
  const dates = getDateRange(14);
  const results = await Promise.all(
    dates.map(async (date) => {
      try {
        const post = await kv.get<HeldPost>(`aria:held:${date}`);
        return post ? { date, post } : null;
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean) as Array<{ date: string; post: HeldPost }>;
}

async function getPublishedPosts(): Promise<Array<{ date: string; post: Post }>> {
  try {
    const dates = await kv.zrange("aria:posts", 0, 9, { rev: true });
    if (!dates.length) return [];
    const posts = await Promise.all(
      (dates as string[]).map(async (date) => {
        const post = await kv.get<Post>(`aria:post:${date}`);
        return post ? { date, post } : null;
      })
    );
    return posts.filter(Boolean) as Array<{ date: string; post: Post }>;
  } catch {
    return [];
  }
}

// ---------- sub-components ----------

function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-hud-dark p-4">
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-xs tracking-widest opacity-50">{children}</div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-4 text-xs tracking-widest opacity-30">[{label}]</div>
  );
}

// ---------- page ----------

export default async function AdminPage() {
  // Guard: re-check session server-side (middleware covers most cases but
  // server component re-validates so the page never renders without auth).
  const cookieStore = cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (!session || session !== process.env.ADMIN_SECRET) {
    redirect("/admin/login");
  }

  let sceneDays: Awaited<ReturnType<typeof getScenes>> = [];
  let heldPosts: Awaited<ReturnType<typeof getHeldPosts>> = [];
  let publishedPosts: Awaited<ReturnType<typeof getPublishedPosts>> = [];
  let kvError = false;

  try {
    [sceneDays, heldPosts, publishedPosts] = await Promise.all([
      getScenes(),
      getHeldPosts(),
      getPublishedPosts(),
    ]);
  } catch {
    kvError = true;
  }

  return (
    <main
      className="w-full bg-black font-mono"
      style={{ color: "var(--green)", height: "100vh", overflowY: "auto" }}
    >
      <div className="mx-auto max-w-3xl px-6 py-10">

        {/* Header */}
        <div className="mb-8 flex items-start justify-between border-b border-hud-dark pb-6">
          <div>
            <div className="mb-1 text-xs tracking-widest opacity-50">ARIA VISION</div>
            <div className="glow text-xl tracking-widest">ADMIN</div>
          </div>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="text-xs tracking-widest opacity-40 transition-opacity hover:opacity-80"
            >
              LOGOUT
            </button>
          </form>
        </div>

        {kvError && (
          <Chrome>
            <div className="text-xs tracking-widest" style={{ color: "#ff3b30" }}>
              [KV CONNECTION FAILED — CHECK ENV VARS]
            </div>
          </Chrome>
        )}

        {!kvError && (
          <div className="space-y-8">

            {/* Held posts */}
            <section>
              <SectionLabel>HELD POSTS</SectionLabel>
              {heldPosts.length === 0 ? (
                <Empty label="NO HELD POSTS" />
              ) : (
                <div className="space-y-3">
                  {heldPosts.map(({ date, post }) => (
                    <Chrome key={date}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="mb-1 text-xs opacity-40">{date}</div>
                          <div className="text-sm tracking-wide">
                            {post.title_en ?? post.title ?? "[UNTITLED]"}
                          </div>
                          {post.reason && (
                            <div className="mt-1 text-xs opacity-40">
                              REASON: {post.reason.slice(0, 120)}
                            </div>
                          )}
                        </div>
                        <form action={releaseHeldPost.bind(null, date)} className="shrink-0">
                          <button
                            type="submit"
                            className="border border-hud px-3 py-1 text-xs tracking-widest transition-opacity hover:opacity-70"
                          >
                            RELEASE
                          </button>
                        </form>
                      </div>
                    </Chrome>
                  ))}
                </div>
              )}
            </section>

            {/* Recent scenes */}
            <section>
              <SectionLabel>RECENT SCENES (3-DAY WINDOW)</SectionLabel>
              {sceneDays.length === 0 ? (
                <Empty label="NO SCENES IN WINDOW" />
              ) : (
                <div className="space-y-4">
                  {sceneDays.map(({ date, scenes }) => {
                    const tz = process.env.LOG_TIMEZONE ?? "America/Los_Angeles";
                    const reversed = [...scenes].reverse();
                    return (
                      <div key={date}>
                        <div className="mb-2 text-xs tracking-widest opacity-50">
                          {date} · {scenes.length} SCENE{scenes.length !== 1 ? "S" : ""}
                        </div>
                        <div className="space-y-1">
                          {reversed.map((scene, i) => {
                            const timeStr = new Date(scene.ts).toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: tz,
                            });
                            const fullDateStr = new Date(scene.ts).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              timeZone: tz,
                            });
                            const readableLocation = formatLocation(scene.location);
                            return (
                              <details
                                key={i}
                                className="border-l border-hud-dark pl-3 text-xs group"
                              >
                                <summary
                                  className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-start gap-1"
                                >
                                  <span className="opacity-30 select-none group-open:opacity-50 shrink-0">▸</span>
                                  <span>
                                    <span className="opacity-40">
                                      {timeStr}
                                      {" PT "}·{" "}
                                      {readableLocation}
                                      {" "}—{" "}
                                    </span>
                                    <span className="opacity-70">{scene.seen.slice(0, 100)}{scene.seen.length > 100 ? "…" : ""}</span>
                                  </span>
                                </summary>
                                <div className="mt-2 ml-3 space-y-1 border-l border-hud-dark pl-3">
                                  <div className="opacity-40">
                                    <span className="tracking-widest">TS</span>
                                    {" "}{fullDateStr} PT
                                  </div>
                                  <div className="opacity-40">
                                    <span className="tracking-widest">LOC</span>
                                    {" "}{readableLocation}
                                  </div>
                                  <div className="opacity-25">
                                    <span className="tracking-widest">RAW</span>
                                    {" "}{scene.location}
                                  </div>
                                  <div className="opacity-70 mt-2 leading-relaxed">{scene.seen}</div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Published posts */}
            <section>
              <SectionLabel>PUBLISHED POSTS (LAST 10)</SectionLabel>
              {publishedPosts.length === 0 ? (
                <Empty label="NO PUBLISHED POSTS" />
              ) : (
                <div className="space-y-2">
                  {publishedPosts.map(({ date, post }) => (
                    <div key={date} className="flex items-baseline justify-between gap-4 text-xs">
                      <div className="opacity-40">{date}</div>
                      <div className="min-w-0 flex-1 truncate">
                        {post.title_en ?? post.title ?? "[UNTITLED]"}
                      </div>
                      <div className="shrink-0 opacity-30">
                        {post.stats.sessions}s · {post.stats.cities.slice(0, 2).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>
        )}

      </div>
    </main>
  );
}
