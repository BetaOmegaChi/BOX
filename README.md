# Beta Omega Chi — Club Website

The official website for the Beta Omega Chi fraternity at Harding University.  
Live at **https://betaomegachi.github.io/BOX/**

---

## For Officers — Handover Checklist

When passing the website to a new officer, transfer access to these three services:

| Service | What it controls | How to transfer |
|---|---|---|
| **GitHub** (`betaomegachi` org) | Source code, auto-deployment | Add new officer as an org member, remove the old one |
| **Supabase** | Database (events) and member logins | Settings → Team → Invite member |
| **GitHub Actions Secrets** | Supabase credentials baked into the build | The secrets stay in the repo — no action needed unless you create a new Supabase project |

> **Nothing else needs to be touched.** Deployment is fully automatic — push to `main` and the site updates itself within ~2 minutes.

---

## Managing Members (Who Can Log In)

Members are managed in the **Supabase dashboard**, not in the code.

1. Go to [supabase.com](https://supabase.com) → your project
2. Click **Authentication → Users** in the left sidebar
3. To add a member: click **Invite user** → enter their email → they receive a link to set their password
4. To remove a member: click the three-dot menu next to their name → **Delete user**

Only logged-in members can create, edit, or delete events. Anyone can view the calendar.

---

## Managing Events

Events are managed directly on the website — no dashboard needed.

1. Log in at `/login`
2. Navigate to the calendar and click any date
3. Use the **Add Event** form to create an event
4. Click **Edit** or **Delete** on any existing event

Events appear live across all devices — no refresh needed.

---

## Updating Social Links

The Instagram and Square checkout links appear in the **NavBar** and **Footer**.  
To update them, edit these two files on GitHub:

- **Instagram** — search for `instagram.com/huinstabox` in `src/NavBar.jsx` and `src/Footer.jsx`
- **Square Checkout** — search for `checkout.square.site` in `src/Footer.jsx`

Replace the URLs with the new ones and commit. The site will rebuild automatically.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7 |
| Database & Auth | Supabase (PostgreSQL + built-in auth) |
| Build | Webpack 5, Babel 7 |
| Hosting | GitHub Pages — auto-deployed from `/docs/` |

---

## Developer Setup

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- A Supabase account (free at [supabase.com](https://supabase.com))

### 1. Clone and install

```bash
git clone https://github.com/betaomegachi/BOX.git
cd BOX
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. In **SQL Editor**, run the schema below to create the events table
3. In **Database → Replication**, enable real-time for the `events` table
4. Go to **Project Settings → API** and copy your **Project URL** and **anon key**

**Database schema:**

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

### 3. Set environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

These are baked into the bundle at build time by Webpack's `DefinePlugin`. The anon key is safe to expose — Supabase security is enforced by Row Level Security policies on the database, not by hiding the key.

### 4. Run the dev server

```bash
npm start
```

App runs at **http://localhost:8080**. All SPA routes work without a 404 thanks to `historyApiFallback`.

### 5. Production build

```bash
npm run build
```

Output goes to `/dist/`. The CI workflow copies this to `/docs/` for GitHub Pages.

---

## Deployment

Pushing any change to `main` automatically triggers the GitHub Actions workflow in `.github/workflows/publish-docs.yml`, which:

1. Installs dependencies
2. Builds with Webpack → `/dist/`
3. Copies `/dist/` → `/docs/` (also writes `404.html` for deep-link support)
4. Commits and pushes `/docs/` back to `main`
5. GitHub Pages serves the updated site from `/docs/`

**GitHub Actions Secrets required** (set under repo Settings → Secrets → Actions):

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon/public key |

---

## Project Structure

```
src/
  main.jsx            React entry point — mounts the app
  App.jsx             Router shell — defines all routes and page layout
  supabase.js         Supabase client — exports `supabase` and `mapEvent`
  auth.js             Auth helpers — signIn, logOut, watchUser, signUp
  logger.js           Dev-only logger — silent no-ops in production

  HomePage.jsx        Landing page — hero, about section, next 5 events
  CalendarPage.jsx    Monthly grid — live event indicators, swipe & keyboard nav
  ViewDatePage.jsx    Day view — event list + create/edit/delete (auth required)
  LoginPage.jsx       Email/password sign-in form
  NavBar.jsx          Responsive header — auth-aware login/logout button
  Footer.jsx          Social links and Square checkout

static/
  index.html          HTML template — Webpack injects the bundle here

.github/
  workflows/
    publish-docs.yml  CI/CD — builds and deploys to GitHub Pages on every push
```

---

## Data Model

**Table: `events`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated primary key |
| `date_key` | text | `"YYYY-MM-DD"` — used in all queries |
| `title` | text | Event name |
| `description` | text | Optional details |
| `all_day` | boolean | If true, `start_time`/`end_time` are empty |
| `start_time` | text | 24-hour `"HH:MM"`, empty when `all_day` |
| `end_time` | text | 24-hour `"HH:MM"`, empty when `all_day` |
| `owner_id` | uuid | Supabase user ID of the member who created it |
| `created_at` | timestamptz | Set automatically on insert |

---

## Keyboard Shortcuts

| Page | Key | Action |
|---|---|---|
| Calendar | `←` / `PageUp` | Previous month |
| Calendar | `→` / `PageDown` | Next month |
| Calendar | `T` | Jump to today |
| Day view | `←` / `PageUp` | Previous day |
| Day view | `→` / `PageDown` | Next day |

Shortcuts are suppressed when focus is inside a text input or textarea.

---

## Debugging

The `src/logger.js` utility prefixes dev-console messages by area. All calls are **silent no-ops in production**.

| Prefix | Colour | Content |
|---|---|---|
| `[BOX]` | blue | General info |
| `[BOX:firebase]` | orange | Database fetch / real-time events |
| `[BOX:auth]` | green | Auth state changes, sign-in/out |
| `[BOX:warn]` | yellow | Non-fatal warnings (e.g. missing env vars) |
| `[BOX:error]` | red | Errors from database writes or auth |

---

## Common Issues

**Blank screen on load**  
The Supabase credentials are missing or wrong. Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly in GitHub Actions secrets, then re-run the workflow.

**"Failed to fetch" on login**  
The `SUPABASE_URL` secret is set to the wrong value — it should be `https://your-project.supabase.co`, not the Supabase dashboard URL.

**Invite email goes to localhost**  
In Supabase → Authentication → URL Configuration, set the **Site URL** to `https://betaomegachi.github.io/BOX/` and add it to **Redirect URLs**.

**Calendar dates not clickable**  
Hard-refresh the page (`Ctrl+Shift+R` / `Cmd+Shift+R`) to clear a stale cached bundle.

**Email rate limit on invites**  
Supabase free tier allows 4 emails per hour. Wait an hour and try again, or set up a custom SMTP provider in Supabase → Project Settings → Auth.
