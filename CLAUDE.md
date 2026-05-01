# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Beta Omega Chi fraternity website — a React SPA deployed to GitHub Pages, backed by Supabase (PostgreSQL database + auth).

## Commands

```bash
npm start        # Dev server at http://localhost:8080 (webpack-dev-server, SPA fallback enabled)
npm run build    # Production build → /dist/
```

No test framework is configured.

## Deployment

Pushing to `main` triggers a GitHub Actions workflow (`.github/workflows/publish-docs.yml`) that:
1. Builds with webpack → `/dist/`
2. Copies `/dist/` to `/docs/` (adds 404.html for SPA deep linking, `.nojekyll`)
3. Commits and pushes the `/docs/` directory
4. GitHub Pages serves from `/docs/`

The router uses `basename="/BetaOmegaChi"` in `App.jsx` to match the GitHub Pages URL path.

## Architecture

**Entry points:**
- `static/index.html` — HTML template (Webpack injects bundle here, `id="root"`)
- `src/main.jsx` — ReactDOM root render
- `src/App.jsx` — Router with all routes

**Routes:**
- `/` → `HomePage` — next 5 upcoming events (real-time)
- `/calendar` → `CalendarPage` — monthly grid view (real-time)
- `/view-date/:dateKey` → `ViewDatePage` — event CRUD (write access requires auth)
- `/login` → `LoginPage` — Supabase email/password auth

**Supabase:**
- `src/supabase.js` — exports `supabase` client and `mapEvent` (DB row → camelCase)
- `src/auth.js` — auth helper functions (signIn, logOut, watchUser, signUp)
- DB table: `events` — columns: `id`, `date_key`, `title`, `description`, `start_time`, `end_time`, `all_day`, `owner_id`, `created_at`
- Real-time via `supabase.channel().on('postgres_changes', ...)` on HomePage, CalendarPage, ViewDatePage
- Authenticated users (Supabase Auth) can create, edit, and delete events on ViewDatePage
- Row Level Security (RLS) enforces public read / auth-only write on the `events` table

**Env vars (build-time, injected by Webpack DefinePlugin):**
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_ANON_KEY` — your Supabase anon/public key (safe to expose in browser)

**Styling:** Each component has a paired `.css` file. Global styles in `src/main.css` and `src/style.css`.

## Supabase Setup (for new maintainers)

1. Create a free project at https://supabase.com
2. In the SQL Editor, run:

```sql
create table events (
  id          uuid        default gen_random_uuid() primary key,
  date_key    text        not null,
  title       text        not null,
  description text        default '',
  all_day     boolean     default false,
  start_time  text        default '',
  end_time    text        default '',
  owner_id    uuid        references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

alter table events enable row level security;

create policy "Public read"   on events for select using (true);
create policy "Auth insert"   on events for insert with check (auth.uid() = owner_id);
create policy "Owner update"  on events for update using (auth.uid() = owner_id);
create policy "Owner delete"  on events for delete using (auth.uid() = owner_id);

create index events_date_key_idx on events (date_key);
```

3. Enable Realtime for the `events` table: Database → Replication → toggle `events`
4. Copy your Project URL and anon key from Project Settings → API
5. Add members via Authentication → Users → Invite user
6. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` as GitHub Actions secrets (Settings → Secrets → Actions)
7. Copy `.env.example` → `.env` and fill in those same values for local development
