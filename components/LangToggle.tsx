import Link from "next/link";
import type { Lang } from "@/lib/i18n";

export default function LangToggle({ lang }: { lang: Lang }) {
  return (
    <div className="mt-3 flex items-center gap-2 text-xs tracking-widest">
      {lang === "en" ? (
        <span className="glow">[EN]</span>
      ) : (
        <Link href="/log?lang=en" className="opacity-40 transition-opacity hover:opacity-80">
          [EN]
        </Link>
      )}
      <span className="opacity-20">·</span>
      {lang === "es" ? (
        <span className="glow">[ES]</span>
      ) : (
        <Link href="/log?lang=es" className="opacity-40 transition-opacity hover:opacity-80">
          [ES]
        </Link>
      )}
    </div>
  );
}
