# Cinelog — Personal Film Analytics SaaS

**Cinelog** is a cloud-based personal film analytics dashboard built around viewing velocity, habits, and deep statistical telemetry — powered by **Vite + React 19 + TypeScript + Tailwind CSS v4 + Recharts** on the frontend and **Supabase (PostgreSQL, Auth, RLS, Deno Edge Functions)** on the backend.

---

## Project Folder Structure

```text
MovieTracker2/
├── index.html
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── vite.config.ts
├── .env.example
├── public/
│   └── favicon.svg
├── supabase/
│   ├── config.toml
│   ├── functions/
│   │   ├── .env.example
│   │   └── tmdb-proxy/
│   │       └── index.ts         # Secure TMDB search, metadata enrichment & shared cache
│   └── migrations/
│       └── 20261120110000_init_cinelog.sql  # profiles, movies, watch_logs, watch_entries + RLS
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css                # Tailwind v4 theme tokens (#0b0e17, #111524, Inter, JetBrains Mono)
│   ├── types/
│   │   └── cinelog.ts
│   ├── lib/
│   │   ├── analytics.ts         # Pure analytics engine (Viewing Index, 365-day cumulative, heatmap, eras)
│   │   ├── analytics.test.ts    # Unit tests verifying exact KPIs, Viewing Index, and empty states
│   │   ├── csvImport.ts         # RFC 4180 CSV (Letterboxd/IMDb), Russian .txt diary & JSON parser
│   │   ├── csvImport.test.ts    # Unit tests for CSV/TXT parsing, 10-pt scaling, duplicate/rewatch detection
│   │   ├── demoData.ts          # Deterministic multi-year sample archive (2024: 84, 2025: 108, 2026: 122)
│   │   └── supabase.ts          # Supabase Auth, watch_entries queries, Edge Function calls & batch upserts
│   └── components/
│       ├── Header.tsx
│       ├── Tier1KpiSection.tsx
│       ├── Tier2DynamicsSection.tsx
│       ├── Tier3RhythmSection.tsx
│       ├── Tier4DeepAnalyticsSection.tsx
│       ├── JournalSection.tsx
│       ├── AddWatchModal.tsx
│       ├── CsvImportModal.tsx
│       └── AuthModal.tsx
└── legacy/                      # Previous vanilla HTML/JS prototype archived for reference
```

---

## Key Capabilities & Dashboard Tiers

* **Tier 1 — Top KPI Row & Viewing Index:**
  * Unique films vs. total watches (`298` unique / `314` total in Demo Mode).
  * Selected year, current month, and rolling 7-day watch counts paired with compact rewatch badges (`↺ X пересмотров`) and hover tooltips.
  * Highlighted **Viewing Index** card (Yearly Index + full-year forecast, Monthly Index + pace badge) — intentionally omitting weekly index to avoid short-term noise.
* **Tier 2 — Primary Dynamics:**
  * `CUMULATIVE FILMS — ALL YEARS COMPARED (DAY OF YEAR)` across 365 days with clickable outlined legend buttons, horizontal plateau after the active day (`Day 324` in Demo Mode), and YoY delta tooltip.
  * `Viewing Index Trajectory` area/line chart with a dashed `1.0` reference line.
* **Tier 3 — Habits & Rhythm:**
  * `FILMS WATCHED PER MONTH — BY YEAR` grouped bar chart.
  * `DAY OF WEEK` distribution with peak highlight.
  * `TIME OF THE DAY` (`Утро / День / Вечер / Ночь`) with honest empty state when imported logs have `watched_time IS NULL`.
* **Tier 4 — Deep Analytics:**
  * GitHub-style 365-day activity heatmap with active day count, max streak, and movie-title hover tooltips.
  * Rating distribution histogram (`1.0★–5.0★`) & monthly average rating trend.
  * Release-year eras breakdown & classic share (`до 2000`).
  * Runtime hours per month + total hours & days watched.
  * Top-6 Taste Accents across Directors, Countries, and Genres.
* **Workflows:**
  * Zero-friction interactive **Demo Mode** + **Supabase Auth** (Email/Password & Google OAuth).
  * `+ Добавить просмотр` modal with live TMDB Edge Function search & metadata caching.
  * Drag-and-drop **Smart CSV / Diary Import** (Letterboxd, IMDb, Russian `.txt`, `.json`) with duplicate skipping, automatic rewatch flagging, and Supabase batch `upsert`.

---

## Phase 1–4 Setup & Execution Checklist

1. **Install & Configure Environment:**
   * Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
   * Run `npm install` and verify locally with `npm run dev`.
2. **Apply Database Migration (`supabase/migrations/20261120110000_init_cinelog.sql`):**
   * `supabase link --project-ref <your-project-ref>`
   * `supabase db push`
   * Enable Google OAuth provider in Supabase Dashboard → Authentication → Providers if desired.
3. **Deploy TMDB Edge Function (`supabase/functions/tmdb-proxy/index.ts`):**
   * Set secret: `supabase secrets set TMDB_READ_ACCESS_TOKEN=<your-tmdb-v4-token>`
   * Deploy: `supabase functions deploy tmdb-proxy --no-verify-jwt` (auth JWT is verified inside the function via `getClaims()` / `getUser()`).
4. **Verify Tests & Production Build:**
   * `npm run typecheck`
   * `npm test`
   * `npm run build`
