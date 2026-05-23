# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Beta Omega Chi fraternity website — a React SPA deployed to Vercel, backed by Supabase (PostgreSQL + auth).  
Live at: `https://box-website-pi.vercel.app/`

## Commands

```bash
npm start            # Dev server at http://localhost:8080
npm run build        # Production build → /dist/ (publicPath=/)
```

No test framework is configured.

## Deployment

Pushing to `main` triggers an automatic Vercel deployment. Vercel runs `npm run build`, serves from `/dist/`, and handles SPA deep-link routing via the rewrite rule in `vercel.json`.

No CI workflow needed — Vercel deploys directly from the GitHub repo.

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

**No `basename`** needed — Vercel serves from the root, so `BrowserRouter` uses `/` with no path prefix.

**Local dev** — run `npm start` to serve the site at http://localhost:8080. The dev server uses `publicPath: 'auto'` so no code changes are needed when switching branches.

## Supabase Setup (for new maintainers)

1. Create a free project at https://supabase.com
2. Run the SQL schema from README.md in the SQL Editor
3. Enable Realtime for the `events` table: Database → Replication → toggle `events`
4. Add members via Authentication → Users → Invite user
5. Copy Project URL and anon key from Project Settings → API
6. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Environment Variables in the Vercel project dashboard
7. Copy `.env.example` → `.env` and fill in the same values for local dev
8. In Authentication → URL Configuration, set Site URL to `https://box-website-pi.vercel.app`

## Future plans for the website 

1. ~~Host on Vercel instead of GitHub Pages~~ ✓ Done
2. Add officers as users on Supabase so they can add to the calendar

## Potential ideas to think about

1. Add some pictures of the members so its not just green
2. Add a suggestion box/ link to google forms. Regular members can add things to the calendar like soccer at 5pm so they can plan their own events around our official schedule
3. Maybe put a link to the calculator that is only accessible to harding emails. Possibly only box emails as well
4. Eventually let all members have accounts with limited permissions
5. Come up with more ideas
6. Officer only view for calendar for meetings and such
7. 
