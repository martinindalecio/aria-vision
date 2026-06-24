import kv from "@/lib/kv";
import LogFeed from "@/components/LogFeed";
import { parseLang, t, type Lang } from "@/lib/i18n";

export const revalidate = 300;

type Post = {
  title_en?: string;
  body_md_en?: string;
  title_es?: string;
  body_md_es?: string;
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

export default async function LogPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = parseLang(searchParams.lang);
  const posts = await getPosts();

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: "#000",
        color: "var(--green)",
        overflowY: "auto",
        height: "100vh",
      }}
    >
      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* Header */}
        <div className="mb-6 border-b border-hud-dark pb-6">
          <div className="mb-1 font-mono text-xs tracking-widest opacity-50">
            ARIA VISION
          </div>
          <h1 className="glow mb-1 font-mono text-xl tracking-widest">DAILY LOG</h1>
          <div className="font-mono text-xs opacity-40">
            {t("subtitle", lang)}
          </div>
        </div>

        {/* Client feed — owns lang toggle, post list, back link */}
        <LogFeed posts={posts} ssrLang={lang} />

        {/* Footer */}
        <div className="mt-16 border-t border-hud-dark pt-6 font-mono text-xs opacity-30">
          <div className="tracking-widest">{t("footer", lang)}</div>
        </div>
      </div>
    </div>
  );
}
