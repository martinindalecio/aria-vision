# Plan — GPS-based location with IP-country fallback

**For:** execution by Sonnet later. Self-contained — read top to bottom.
**Owner workflow reminders:** feature branch → PR → Martin merges → Vercel deploys.
Never push to `main`. Never `vercel deploy` CLI. Never `git add -A` (REFACTOR.md +
scripts/ are untracked). Gemini model stays `gemini-3.1-flash-lite`. Follow
`DESIGN.md` for any UI.

---

## Problem (root cause)

Every scene's location comes from **Vercel IP-geolocation edge headers**
(`x-vercel-ip-city`, `x-vercel-ip-country-region`, `x-vercel-ip-country`), read
per vision request in [app/api/vision/route.ts:129](app/api/vision/route.ts:129)
via `formatLocationFromHeaders`, stored on each scene as `location`, then split
by the cron into `cities[]` / `countries[]` for the daily narrative.

IP→**city** is unreliable on **mobile/cellular**. A phone physically in SF egresses
through whatever carrier PoP serves it (San Jose, Seattle, …), and each request can
hit a different PoP. Result: the June narrative scatters one SF day across San Jose,
Seattle, and "random places." IP→**country** ("US") is reliable; IP→**city** is not.

This is not a code bug — it's the ceiling of IP geolocation. The fix is to get
location from the device's GPS when the user allows it, and degrade to
country-only (drop the wrong city) when they don't.

> **Scope read:** "geofencing" here means *use the phone's GPS for accurate
> city-level location*, not literal geo-boundary enter/exit detection. If Martin
> meant true geofences (only log inside a drawn boundary), the plan changes —
> confirm before building.

---

## Goal

1. **Primary — GPS:** request browser geolocation; reverse-geocode to city/region/
   country on the **client**; send only those readable names to the server.
2. **Fallback — IP country only:** if the user declines or geolocation fails, keep
   the app fully working and store **country only** (no city, since IP city is the
   faulty part).
3. **Never block.** Declining location must not stop the camera/HUD.
4. **Never store precise coordinates.** Raw lat/lng stays on the device. City-level
   is the privacy floor (matches the privacy reviewer in `lib/narrative.ts` and the
   existing TODO consent gate).

This preserves the narrative: accurate city grouping ("morning in the Mission,
afternoon in SoMa") instead of teleporting across PoP cities.

---

## Decisions (recommended defaults — Martin can override before execution)

- **D-A — Reverse-geocode provider.** Use a **client-side, keyless** reverse
  geocoder so precise coords never touch our server and we add no secret.
  Recommended: **BigDataCloud** `reverse-geocode-client` (free, no key, CORS-enabled).
  - Alternative: server-side keyed provider (Google/Mapbox). Rejected by default:
    adds a secret, coords transit our server, and re-introduces the
    `vercel-stale-env-on-key-change` foot-gun. Only pick this if BigDataCloud's
    terms/accuracy don't hold up.
  - **Sonnet must verify** BigDataCloud's current free-tier terms and live response
    field names before wiring (see field mapping in Step 2).
- **D-B — Consent UX (taste).** Native browser geolocation prompt **is** the consent
  gate. Recommended: one short in-app rationale line, then fire the native prompt
  once after language is selected. No full-screen explainer.
- **D-C — Cadence (taste).** Acquire location **once per session**, cache it, attach
  to every vision POST. The user stays in one city per day; per-frame geolocation
  would hammer the reverse-geocoder and drain battery for no gain.

---

## Changes

### Step 1 — Client geo module: `lib/geo.ts` (new, `"use client"` helper)

Export `getSessionLocation(): Promise<GeoResult | null>` where
`GeoResult = { city: string; region: string; country: string }` (readable names).

- Call `navigator.geolocation.getCurrentPosition` with
  `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }`.
  Coarse accuracy is enough for city, costs less battery, and is more private.
- On success: reverse-geocode client-side (D-A). Map the response →
  `{ city, region, country }` (readable names, see Step 2). Cache the result in
  module memory **and** `sessionStorage` (`aria:geo`) so a reload doesn't re-prompt.
- On denial / unsupported / timeout / reverse-geocode failure: resolve `null`.
  Persist the denial in `localStorage` (`aria:geo-denied`) so we don't auto-reprompt
  every load.
- Pure failure-tolerant: never throw to the caller.

### Step 2 — Reverse geocode mapping (inside `lib/geo.ts`)

`GET https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`

Map (verify field names against a live response):
- `city` ← `city || locality` (BigDataCloud sometimes only fills `locality`)
- `region` ← `principalSubdivision` (readable, e.g. "California")
- `country` ← `countryName` (e.g. "United States")

Sanitize each field: trim, cap length (~60 chars), and **strip commas** (storage
joins on `", "` — an embedded comma would corrupt the cron's split). Drop empties.
If the call fails or returns no usable fields → treat as `null` (Step 1 fallback).

### Step 3 — Send geo with each vision request: `app/page.tsx`

- After language is chosen (the capture loop already gates on `lang`), call
  `getSessionLocation()` **once**; store the result in a ref (`geoRef`).
- In `runCapture`, include it in the POST body when present:
  `body: JSON.stringify({ imageBase64: frame, prevContext, geo: geoRef.current ?? undefined })`.
- Acquisition must not block capture: kick it off in parallel; until it resolves,
  requests simply omit `geo` (server falls back to country-only for those early
  frames — acceptable).
- Consent rationale line (D-B): render one short DESIGN.md-styled line before/at the
  native prompt, e.g. `ALLOW LOCATION TO PIN YOUR CITY — OPTIONAL`.

### Step 4 — Server resolves location: `app/api/vision/route.ts`

Add `geo?` to `VisionRequestBody`: `{ city?: string; region?: string; country?: string }`.

Resolve one `location` string, used for **both** the scene store and `logOutcome`:
- **If `body.geo` has at least a country:** sanitize the same way (trim, length cap,
  strip commas, drop empties), then `location = [city, region, country].filter(Boolean).join(", ")`.
- **Else (no/partial geo):** IP **country only** —
  `location = decode(get("x-vercel-ip-country")) || "unknown"`. Do **not** read the
  IP city/region anymore.

Refactor so location is computed once (a helper `resolveLocation(req, body.geo)`),
then passed into `logOutcome(...)` (drop its duplicated header block) and used for
the `aria:scenes:<date>` push. `formatLocation` already passes readable names
through idempotently and still expands a lone country code, so the `/log` render and
narrative need no change.

### Step 5 — `lib/location.ts`

- Add `countryOnlyFromHeaders(get): string` → decoded `x-vercel-ip-country` or
  `"unknown"`. Use it in Step 4's fallback.
- `formatLocationFromHeaders` is now unused by the vision route — remove it if no
  other caller remains (grep first), or leave with a deprecation note.
- No change needed to `formatLocation`/`STATE_MAP` (readable names pass through;
  lone country code still expands).

### Step 6 — Cron stats fix: `app/api/cron/daily-log/route.ts`

Country-only scenes ("United States" — no comma) must **not** count as cities.
Today `s.location.split(", ")[0]` would list "United States" as a city.

- `cities` = only scenes whose `location` contains `", "`, take `parts[0]`.
- `countries` = `parts[parts.length - 1]` as today (works for both shapes).

This keeps the narrative's "cities" list honest when users decline GPS.

---

## Privacy hard rules (do not violate)

- Raw lat/lng **never** leaves the device and is **never** stored. Only
  city/region/country names are sent to the server.
- Geolocation is strictly opt-in; the native prompt is the consent. Denial is
  remembered and never silently re-prompted.
- Declining location never degrades the camera/HUD experience.
- City-level remains the floor — no neighborhood-precise or coordinate data in KV
  or logs.

---

## Test / QA (real mobile is the point — desktop wifi geo differs)

1. **Allow GPS in SF** → scenes store `San Francisco, California, United States`;
   `/log` and the next narrative group SF correctly; no PoP cities.
2. **Deny GPS** → app keeps running; scenes store country only (`United States`);
   narrative shows the country with **no** false cities; no console errors.
3. **Reverse-geocode network failure** → graceful country-only or `unknown`; app
   unaffected.
4. **Cron stats** → trigger `daily-log` with a mix of GPS + denied scenes; confirm
   country-only entries don't appear in `cities[]`.
   Manual trigger: `curl -s -H "Authorization: Bearer $CRON_SECRET" "https://aria.martingalaz.com/api/cron/daily-log?date=YYYY-MM-DD"`.
5. **No re-prompt** → reload after allow and after deny; verify the choice sticks.

---

## Deploy

- Feature branch (e.g. `feat/gps-location`) → PR → Martin merges → Vercel auto-deploys.
- **No new env var** if D-A (keyless) holds. If a keyed provider is chosen instead,
  add the secret via `vercel env`, redeploy, and respect `vercel-stale-env-on-key-change`.
- `runtime`/`maxDuration` unchanged. Build is the verification gate (no test suite).

---

## Out of scope

- Literal geofence boundary enter/exit logic (confirm interpretation first).
- Maps, neighborhood/precise-location features, or storing coordinates.
- Backfilling/cleaning past scenes with wrong IP cities (3-day TTL ages them out).
- Periodic in-session location refresh (once per session is enough; revisit only if
  a real multi-city session need appears).
