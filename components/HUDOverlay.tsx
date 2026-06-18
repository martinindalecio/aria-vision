"use client";

type HUDOverlayProps = {
  lines: string[];
  isLoading: boolean;
  cost: string;
  tokens: { input: number; output: number };
  isPaused: boolean;
  isOnline: boolean;
};

export default function HUDOverlay({
  lines,
  isLoading,
  cost,
  tokens,
  isPaused,
  isOnline,
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
          <span className="glow whitespace-nowrap">
            IN: {tokens.input.toLocaleString("en-US")} | OUT:{" "}
            {tokens.output.toLocaleString("en-US")}
          </span>

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

          <span className="glow whitespace-nowrap">{cost}</span>
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
                {line}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
