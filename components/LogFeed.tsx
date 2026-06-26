"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LogPost from "@/components/LogPost";
import { parseLang, t, type Lang } from "@/lib/i18n";

type Post = {
  title_en?: string;
  body_md_en?: string;
  title_es?: string;
  body_md_es?: string;
  title: string;
  body_md: string;
  stats: { sessions: number; cities: string[]; countries: string[] };
  published_at: string;
  date: string;
};

function pickTitle(post: Post, lang: Lang): string {
  if (lang === "es") return post.title_es ?? post.title_en ?? post.title;
  return post.title_en ?? post.title;
}

function pickBody(post: Post, lang: Lang): string {
  if (lang === "es") return post.body_md_es ?? post.body_md_en ?? post.body_md;
  return post.body_md_en ?? post.body_md;
}

function safeLsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeLsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export default function LogFeed({
  posts,
  ssrLang,
}: {
  posts: Post[];
  ssrLang: Lang;
}) {
  const [lang, setLang] = useState<Lang>(ssrLang);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = safeLsGet("aria:lang");
    if (stored) setLang(parseLang(stored));
    setHydrated(true);
  }, []);

  function toggleLang() {
    setLang((prev) => {
      const next: Lang = prev === "es" ? "en" : "es";
      safeLsSet("aria:lang", next);
      return next;
    });
  }

  const PAGE_SIZE = 3;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const pagePosts = posts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      {/* Lang toggle */}
      <div className="mt-3 flex items-center gap-2 font-mono text-xs tracking-widest">
        <button
          onClick={toggleLang}
          className="flex items-center gap-2"
          aria-label="toggle language"
          suppressHydrationWarning
        >
          <span className={lang === "en" ? "glow" : "opacity-40 transition-opacity hover:opacity-80"}>[EN]</span>
          <span className="opacity-20">·</span>
          <span className={lang === "es" ? "glow" : "opacity-40 transition-opacity hover:opacity-80"}>[ES]</span>
        </button>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="py-16 text-center font-mono text-sm opacity-40">
          <div className="mb-2 tracking-widest">{t("emptyHeading", lang)}</div>
          <div className="text-xs">{t("emptySub", lang)}</div>
        </div>
      ) : (
        <div className="mt-10 space-y-12">
          {pagePosts.map((post) => (
            <PostEntry key={post.date} post={post} lang={lang} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-12 flex items-center gap-4 font-mono text-xs tracking-widest">
          <button
            onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}
            disabled={page === 0}
            className="opacity-40 transition-opacity hover:opacity-80 disabled:opacity-20 disabled:cursor-default"
          >
            ← NEWER
          </button>
          <span className="opacity-30">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}
            disabled={page === totalPages - 1}
            className="opacity-40 transition-opacity hover:opacity-80 disabled:opacity-20 disabled:cursor-default"
          >
            OLDER →
          </button>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/"
        className="mt-8 inline-block font-mono text-xs tracking-widest opacity-40 transition-opacity hover:opacity-80"
      >
        {t("backToHud", lang)}
      </Link>
    </>
  );
}

function SourceStrip({ post, lang }: { post: Post; lang: Lang }) {
  const { sessions, cities, countries } = post.stats;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
      <span className="tracking-widest opacity-60" style={{ color: "var(--green-dim)" }}>SOURCE</span>
      {cities.length > 0 && cities.map((city) => (
        <span
          key={city}
          className="border border-hud-dark px-1.5 py-0.5 tracking-wide"
          style={{ color: "var(--green)" }}
        >
          {city}
        </span>
      ))}
      <span className="opacity-60" style={{ color: "var(--green-dim)" }}>
        {sessions} {t("scenes", lang)}
      </span>
      {countries.length > 0 && (
        <span className="opacity-60" style={{ color: "var(--green-dim)" }}>
          {countries.length} {countries.length === 1 ? "country" : "countries"}
        </span>
      )}
    </div>
  );
}

function PostEntry({ post, lang }: { post: Post; lang: Lang }) {
  return (
    <article id={post.date} className="border-t border-hud-dark pt-4">
      <div className="mb-4">
        <a
          href={`#${post.date}`}
          className="mb-1 block font-mono text-xs tracking-widest opacity-40 transition-opacity hover:opacity-70"
        >
          {post.date} · PT
        </a>
        <h2
          className="text-base tracking-wide leading-snug"
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            color: "var(--green)",
            textShadow: "0 0 8px var(--green)",
          }}
        >
          <a
            href={`#${post.date}`}
            className="group transition-opacity hover:opacity-90"
          >
            {pickTitle(post, lang)}
            <span className="ml-2 text-sm opacity-0 transition-opacity group-hover:opacity-50">↗</span>
          </a>
        </h2>
        <SourceStrip post={post} lang={lang} />
      </div>
      <LogPost body={pickBody(post, lang)} />
    </article>
  );
}
