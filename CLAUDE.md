# Aria Vision — project instructions

## Portfolio sync

This project appears on Martin's portfolio at https://martingalaz.com. The site
reads project metadata from an Airtable base, so the portfolio updates itself —
no edits to martingalaz.com needed.

How it works:
- `.portfolio.json` (repo root) holds this project's portfolio card: name,
  status, url, year, tags, and EN/ES descriptions.
- `.github/workflows/portfolio-sync.yml` runs on push to `main` whenever
  `.portfolio.json` changes, and upserts the row in Airtable (keyed on `name`).
- martingalaz.com revalidates within 24h and shows the new data.

When this project's public-facing story changes (ships, gets a URL, status moves
Prototype → Live, new tagline), update `.portfolio.json` and push to `main`.
Don't change the `name` field — it's the upsert key.

Requires repo secrets `AIRTABLE_TOKEN` and `AIRTABLE_BASE_ID` (Settings →
Secrets → Actions).

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.
