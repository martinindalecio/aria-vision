import Link from "next/link";
import kv from "@/lib/kv";
import LogPost from "@/components/LogPost";

export const revalidate = 300;

type Post = {
  title: string;
  body_md: string;
  stats: { sessions: number; cities: string[]; countries: string[] };
  published_at: string;
};

async function getPosts(): Promise<Array<Post & { date: string }>> {
  try {
    const dates = await kv.zrange("aria:posts", 0, 30, { rev: true });
    if (!dates.length) return [];
    const posts = await Promise.all(
      (dates as string[]).map(async (date) => {
        const post = await kv.get<Post>(`aria:post:${date}`);
        return post ? { ...post, date } : null;
      })
    );
    return posts.filter(Boolean) as Array<Post & { date: string }>;
  } catch {
    return [];
  }
}

export default async function LogPage() {
  const posts = await getPosts();

  return (
    <div
      className="min-h-screen w-full font-mono"
      style={{
        background: "#000",
        color: "var(--green)",
        overflowY: "auto",
        height: "100vh",
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Header */}
        <div className="mb-10 border-b border-hud-dark pb-6">
          <div className="mb-1 text-xs tracking-widest opacity-50">
            ARIA VISION
          </div>
          <h1 className="glow mb-1 text-xl tracking-widest">DAILY LOG</h1>
          <div className="text-xs opacity-40">
            what i saw through strangers&#39; cameras
          </div>
          <Link
            href="/"
            className="mt-4 inline-block text-xs tracking-widest opacity-40 transition-opacity hover:opacity-80"
          >
            ← BACK TO HUD
          </Link>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="py-16 text-center text-sm opacity-40">
            <div className="mb-2 tracking-widest">NO ENTRIES YET</div>
            <div className="text-xs">
              ARIA will publish her first diary at 06:00 UTC
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            {posts.map((post) => (
              <article key={post.date} id={post.date}>
                <div className="mb-4 border-b border-hud-dark pb-2">
                  <a
                    href={`#${post.date}`}
                    className="mb-1 block text-xs tracking-widest opacity-40 transition-opacity hover:opacity-70"
                  >
                    {post.date}
                  </a>
                  <h2 className="glow text-base tracking-wide">{post.title}</h2>
                  <div className="mt-1 text-xs opacity-30">
                    {post.stats.sessions} scenes ·{" "}
                    {post.stats.cities.join(", ")}
                  </div>
                </div>
                <div className="text-sm leading-relaxed opacity-80">
                  <LogPost body={post.body_md} />
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 border-t border-hud-dark pt-6 text-xs opacity-30">
          <div className="tracking-widest">AUTO-PUBLISHED DAILY</div>
        </div>
      </div>
    </div>
  );
}
