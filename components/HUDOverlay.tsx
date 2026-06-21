"use client";

import type { Lang } from "@/lib/i18n";

type HUDOverlayProps = {
  lines: string[];
  isLoading: boolean;
  sceneCount: number;
  isPaused: boolean;
  isOnline: boolean;
  lang: Lang;
  onToggleLang: () => void;
};

// Each Gemini response is a multi-line block. Parse each line individually
// so we don't accidentally split the whole block on the first " / " found.
function parseSingleLine(line: string, lang: Lang): string {
  const slashIdx = line.indexOf(" / ");
  if (slashIdx === -1) return line; // no bilingual separator — return unchanged

  const enPart = line.slice(0, slashIdx);
  const esPart = line.slice(slashIdx + 3);

  if (lang === "en") {
    return enPart.replace(/\|ES\]/g, "]");
  }
  // ES: reconstruct as [FIELD]: es_value
  const labelMatch = enPart.match(/^(\[[A-Z_]+)\|ES\]:/);
  if (labelMatch) return `${labelMatch[1]}]: ${esPart}`;
  return esPart;
}

function parseBlock(block: string, lang: Lang): string {
  return block
    .split("\n")
    .map((l) => parseSingleLine(l.trim(), lang))
    .filter((l) => l.length > 0)
    .join("\n");
}

export default function HUDOverlay({
  lines,
  isLoading,
  sceneCount,
  isPaused,
  isOnline,
  lang,
  onToggleLang,
}: HUDOverlayProps) {
  const visibleLines = lines.slice(-3);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 select-none font-mono text-hud">
      {!isPaused && <div className="scanline" aria-hidden="true" />}

      <div className="hud-corner hud-corner-tl" aria-hidden="true" />
      <div className="hud-corner hud-corner-tr" aria-hidden="true" />
      <div className="hud-corner hud-corner-bl" aria-hidden="true" />
      <div className="hud-corner hud-corner-br" aria-hidden="true" />

      {/* ── Status bar ───────────────────────────────────────── */}
      <div className="pointer-events-auto absolute inset-x-0 top-0 px-4 pt-4">
        <div className="hud-meta relative flex items-start justify-between text-xs">
          <span />

          <span className="absolute left-1/2 top-0 -translate-x-1/2 whitespace-nowrap tracking-widest">
            {isPaused ? (
              <span className="text-hud-dim">❚❚ ARIA STANDBY</span>
            ) : isOnline ? (
              <span className="glow">
                <span className="animate-pulse">◉</span> ARIA ONLINE
              </span>
            ) : (
              <span className="text-red-500">○ ARIA OFFLINE</span>
            )}
          </span>

          <span className="flex items-center gap-2 whitespace-nowrap">
            <span className="glow">{sceneCount} SEEN TODAY</span>
            <span className="opacity-30">·</span>
            <button
              onClick={onToggleLang}
              className="tracking-widest transition-opacity"
              aria-label="toggle language"
            >
              <span className={lang === "en" ? "glow" : "opacity-40"}>[EN]</span>
              <span className="opacity-20 mx-0.5">|</span>
              <span className={lang === "es" ? "glow" : "opacity-40"}>[ES]</span>
            </button>
          </span>
        </div>
      </div>

      {/* ── ARIA output panel ────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 h-48 border-t border-hud-dark bg-black/70 px-4 py-3 backdrop-blur-sm">
        {isLoading && (
          <span
            className="blink absolute right-3 top-2 text-xs text-red-500"
            aria-hidden="true"
          >
            ●
          </span>
        )}
        <a
          href={`/log?lang=${lang}`}
          className="pointer-events-auto absolute bottom-2 right-3 text-xs text-hud-dim transition-colors hover:text-hud"
        >
          [LOG]
        </a>

        <div className="flex h-full flex-col justify-end gap-2 overflow-hidden">
          {visibleLines.map((line, index) => {
            const age = visibleLines.length - 1 - index; // 0 = newest
            const ageClass =
              age === 0
                ? "opacity-100 glow"
                : age === 1
                  ? "opacity-70"
                  : "opacity-40";
            return (
              <p
                key={`${index}-${line}`}
                className={`aria-line typewriter whitespace-pre-wrap break-words text-sm leading-snug ${ageClass}`}
              >
                {parseBlock(line, lang)}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
