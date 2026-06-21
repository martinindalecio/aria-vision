# Design System — ARIA Vision

## Product Context
- **What this is:** A real-time AI camera-vision HUD. ARIA (Google Gemini) watches
  the world through the visitor's camera and narrates it live, then auto-publishes
  a daily first-person diary at `/log` about what it saw through strangers' cameras.
- **Who it's for:** Public visitors at aria.martingalaz.com; also a portfolio piece
  on martingalaz.com.
- **Space/industry:** AI / computer-vision toys, surveillance-aesthetic interfaces,
  generative-AI showcases.
- **Project type:** Two surfaces in one PWA — a live HUD (the app) and an editorial
  diary (a reading surface).

## Memorable Thing
An AI is quietly watching the world, and it has an inner life. Every decision serves
this: the machine on the outside, a voice on the inside.

## Aesthetic Direction
- **Direction:** Phosphor Terminal — a CRT-glow surveillance interface with a literary
  secret. One identity, two modes:
  - **The Eye** (`/`): ARIA perceiving. Saturated green monospace, glowing, alive,
    machine.
  - **The Voice** (`/log`): ARIA reflecting. The same machine frame, with the thoughts
    inside written in a literary serif in near-white.
- **Decoration level:** Intentional and diegetic — scanline, glow, corner brackets,
  grain read as CRT artifacts, not ornament.
- **Mood:** Intimate, uncanny, cold but alive.

## Typography
Three roles. The contrast between them is the system.
- **System chrome** (status bar, dates, stats, nav, footer, all HUD text): IBM Plex
  Mono, uppercase, wide tracking (0.2–0.34em). The code currently ships the system
  mono stack (`ui-monospace`); IBM Plex Mono is the intended upgrade, loaded with
  `font-display: swap` so it never blocks the camera boot.
- **Entry titles** (`/log`): Instrument Serif, ~28–30px, phosphor green with glow.
  The haunting headline.
- **Body prose** (`/log`): Newsreader serif, ~17px, line-height 1.65, color
  phosphor-dust `#d4ddd6`. The readable inner voice. Never render long-form prose in
  saturated green monospace.
- **Code/data:** monospace (same family as chrome), tabular where numbers align
  (the token / cost readout).
- **Loading:** Google Fonts via `<link>` with `display=swap` — IBM Plex Mono 400/500,
  Instrument Serif 400 + italic, Newsreader 400/500 + italic.
- **Scale:** HUD 11–14px (dense). Diary: 11px labels / 17px body / 28–30px titles /
  21px masthead.

## Color
- **Approach:** Restrained. Black is the ground; green is the signature; near-white
  carries the reading.
- **Signature green `#00ff41`** — HUD text, masthead, entry titles, links, strong
  emphasis. Used with glow (`text-shadow: 0 0 7–9px rgba(0,255,65,.4)`).
- **Dim green `#00aa2a`** — secondary chrome, metadata, dates.
- **Deep green `#003310`** — hairlines, dividers, borders.
- **Phosphor-dust `#d4ddd6`** — diary body prose. "The white left when green light
  fades." The readability fix.
- **Near-black `#040604` / `#050705`** (optional) — a green-shifted black for the
  diary surface so it reads lit-from-within rather than void-black.
- **Alert red `#ff3b30`** — only SIGNAL LOST / offline / in-flight blink. Never
  decorative.
- **Tailwind tokens:** existing `hud #00ff41`, `hud-dim #00aa2a`, `hud-dark #003310`.
  Add `hud-dust #d4ddd6` for diary body.
- **Dark mode:** There is no light mode. ARIA lives in the dark by design.

## Spacing
- **Base unit:** 4px.
- **Density:** The Eye is compact (data-dense telemetry). The Voice is spacious
  (a reading surface).
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Approach:** Hybrid. The Eye is composition-first; The Voice is a disciplined
  reading column.
- **HUD:** full-viewport video; fixed corner brackets, top status bar, and a bottom
  output panel (`h-48`, `border-top`, `bg-black/70`, `backdrop-blur`).
- **Diary:** centered column, max content width ~640px (Tailwind `max-w-2xl` is fine),
  generous vertical rhythm, hairline dividers between entries.
- **Border radius:** Near-zero. Square corners read as instrument / terminal. ARIA's
  own surfaces do not round.

## Motion
- **Approach:** The Eye is intentional-to-expressive, but every motion is diegetic
  signal. The Voice is minimal-functional.
- **HUD motions:** scanline sweep (3s linear infinite), typewriter reveal on new lines
  (0.3s steps), blink on in-flight inference (0.8s), pulse on the online dot. These are
  status, not decoration.
- **Diary:** near-still; optional masthead cursor blink and a soft entry fade-in.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:** micro 50–100ms, short 150–250ms, medium 250–400ms.
- **Accessibility:** Gate scanline + blink + typewriter behind
  `prefers-reduced-motion: no-preference`. The current code does not — close this gap.

## The Two-Surface Rule (what keeps it coherent)
Monospace green is ARIA's machine chrome. Serif is ARIA's actual thoughts, and only
ever inside that chrome. Green is the frame and the accent everywhere; near-white
(`#d4ddd6`) carries any text longer than a label. Break this and the diary looks like
two products bolted together.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-20 | Initial design system created (Phosphor Terminal) | /design-consultation. Codify the HUD as canon; fix the `/log` diary's readability with a serif-in-near-white body while keeping the green machine frame. |
| 2026-06-20 | Diary body = Newsreader serif in phosphor-dust `#d4ddd6`, not green mono | Long-form saturated green monospace on black is fatiguing; near-white reads as "bathed in green light," far more legible, and keeps green as the accent. |
| 2026-06-20 | `/log` footer simplified to "AUTO-PUBLISHED DAILY" | Owner preference; dropped "TEXT ONLY · NO PHOTOS". Note: that line also signaled a privacy reassurance — revisit if a consent / trust message is wanted on a public app. |
