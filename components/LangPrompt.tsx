"use client";

import type { Lang } from "@/lib/i18n";

export default function LangPrompt({ onSelect }: { onSelect: (lang: Lang) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black font-mono">
      <div className="w-full max-w-xs border border-hud-dark px-8 py-10 text-center">
        <div className="mb-1 text-xs tracking-widest opacity-50">ARIA VISION</div>
        <div className="glow mb-8 text-sm tracking-widest">SYSTEM INIT</div>
        <div className="mb-6 text-xs tracking-widest opacity-60">
          SELECT LANGUAGE / SELECCIONAR IDIOMA
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect("en")}
            className="border border-hud-dark px-6 py-3 text-sm tracking-widest text-hud transition-opacity hover:opacity-70"
          >
            [EN] ENGLISH
          </button>
          <button
            onClick={() => onSelect("es")}
            className="border border-hud-dark px-6 py-3 text-sm tracking-widest text-hud transition-opacity hover:opacity-70"
          >
            [ES] ESPAÑOL
          </button>
        </div>
      </div>
    </div>
  );
}
