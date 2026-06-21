import Link from "next/link";
import kv from "@/lib/kv";
import LogPost from "@/components/LogPost";
import LangToggle from "@/components/LangToggle";
import { parseLang, t, type Lang } from "@/lib/i18n";

export const revalidate = 300;

type Post = {
  // bilingual fields (present on posts generated after PR A)
  title_en?: string;
  body_md_en?: string;
  title_es?: string;
  body_md_es?: string;
  // legacy fields (always present — EN copy kept for backward compat)
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

function pickTitle(post: Post, lang: Lang): string {
  if (lang === "es") return post.title_es ?? post.title_en ?? post.title;
  return post.title_en ?? post.title;
}

function pickBody(post: Post, lang: Lang): string {
  if (lang === "es") return post.body_md_es ?? post.body_md_en ?? post.body_md;
  return post.body_md_en ?? post.body_md;
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = parseLang(searchParams.lang);
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
            {t("subtitle", lang)}
          </div>
          <LangToggle lang={lang} />
          <Link
            href="/"
            className="mt-4 inline-block text-xs tracking-widest opacity-40 transition-opacity hover:opacity-80"
          >
            {t("backToHud", lang)}
          </Link>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="py-16 text-center text-sm opacity-40">
            <div className="mb-2 tracking-widest">{t("emptyHeading", lang)}</div>
            <div className="text-xs">{t("emptySub", lang)}</div>
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
                  <h2 className="glow text-base tracking-wide">{pickTitle(post, lang)}</h2>
                  <div className="mt-1 text-xs opacity-30">
                    {post.stats.sessions} {t("scenes", lang)} ·{" "}
                    {post.stats.cities.join(", ")}
                  </div>
                </div>
                <div className="text-sm leading-relaxed opacity-80">
                  <LogPost body={pickBody(post, lang)} />
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-16 border-t border-hud-dark pt-6 text-xs opacity-30">
          <div className="tracking-widest">{t("footer", lang)}</div>
        </div>
      </div>
    </div>
  );
}
