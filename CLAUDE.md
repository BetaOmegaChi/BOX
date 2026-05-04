# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beta Omega Chi fraternity website — a React SPA deployed to GitHub Pages, backed by Supabase (PostgreSQL + auth).  
Live at: `https://beta-omega-chi.github.io/BOX/`

## Commands

```bash
npm start            # Dev server at http://localhost:8080
npm run build        # Production build → /dist/ (mode=production, publicPath=/BOX/)
```

No test framework is configured.

## Deployment

Pushing to `main` triggers `.github/workflows/publish-docs.yml`, which:
1. Builds with Webpack → `/dist/`
2. Copies `/dist/` → `/docs/` (adds `404.html` for SPA deep linking, `.nojekyll`)
3. Commits and pushes `/docs/` back to `main`
4. GitHub Pages serves from `/docs/`

**Important:** `output.publicPath` is set to `/BOX/` in production builds (not `auto`). This ensures asset paths are absolute so the `404.html` deep-link fallback works correctly from any URL depth.

## Architecture

**Entry points:**
- `static/index.html` — HTML template (Webpack injects bundle here)
- `src/main.jsx` — ReactDOM root render
- `src/App.jsx` — Router with `basename="/BOX"` and all routes

**Routes:**
- `/` → `HomePage` — hero + next 5 upcoming events (real-time)
- `/calendar` → `CalendarPage` — monthly grid (real-time)
- `/view-date/:dateKey` → `ViewDatePage` — event CRUD (writes require auth)
- `/login` → `LoginPage` — Supabase email/password auth

**Supabase:**
- `src/supabase.js` — exports `supabase` client and `mapEvent(row)` (snake_case DB → camelCase app)
- `src/auth.js` — thin wrappers: `signIn`, `logOut`, `watchUser`, `signUp`
- DB table: `events` with columns `id`, `date_key`, `title`, `description`, `all_day`, `start_time`, `end_time`, `owner_id`, `created_at`
- Real-time via `supabase.channel().on('postgres_changes', ...)` — all three data pages subscribe
- Row Level Security: public SELECT, auth-only INSERT/UPDATE/DELETE (owner only for writes)

**Env vars (build-time, injected by Webpack DefinePlugin):**
- `SUPABASE_URL` — Supabase project URL (e.g. `https://xyz.supabase.co`)
- `SUPABASE_ANON_KEY` — Supabase anon/public key (safe to expose in browser)

**Styling:**
- `src/main.css` — design tokens (CSS custom properties), reset, base styles
- `src/style.css` — shared component styles (buttons, calendar controls, event rows)
- Each page component has a paired `.css` file

## Key Implementation Details

**`mapEvent(row)`** in `supabase.js` converts DB snake_case columns to the camelCase field names used throughout the app (`date_key` → `dateKey`, `all_day` → `allDay`, etc.). Always use this when reading from Supabase.

**Optimistic updates** in `ViewDatePage` — events are added to local state immediately with a temp ID, then replaced with the real DB ID once the insert confirms. On failure the local state is rolled back.

**Real-time pattern** — each page does an initial `fetch` then subscribes to `postgres_changes`. On any change event, it re-fetches the full dataset rather than diffing the payload. Simple and reliable.

**`basename="/BOX"`** in `App.jsx` must match the GitHub Pages repo path. If the repo is ever renamed, update this value and `output.publicPath` in `webpack.config.js`.

## Supabase Setup (for new maintainers)

1. Create a free project at https://supabase.com
2. Run the SQL schema from README.md in the SQL Editor
3. Enable Realtime for the `events` table: Database → Replication → toggle `events`
4. Add members via Authentication → Users → Invite user
5. Copy Project URL and anon key from Project Settings → API
6. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub Actions secrets
7. Copy `.env.example` → `.env` and fill in the same values for local dev
8. In Authentication → URL Configuration, set Site URL to `https://betaomegachi.github.io/BOX/`
