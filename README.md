# huddle

**Free, open-source live quizzes, polls, word clouds and slides for any crowd** — team all-hands, parties, workshops, meetups and community nights. Players join from their phone with a 6-digit PIN. No app, no account.

---

## Contents

1. [Features](#features)
2. [How it works](#how-it-works)
3. [Quick start with Docker](#quick-start-with-docker)
4. [Setting up the backend (Supabase)](#setting-up-the-backend-supabase)
5. [Authentication options](#authentication-options)
6. [Configuration reference](#configuration-reference)
7. [Local development](#local-development)
8. [Scaling to large audiences](#scaling-to-large-audiences)
9. [Security model](#security-model)
10. [Project structure](#project-structure)
11. [Troubleshooting](#troubleshooting)
12. [Supporting the project](#supporting-the-project)
13. [License](#license)

---

## Features

- **Host screen**: room PIN, QR code, live player list, slide controls, sound, live reactions
- **Player screen**: mobile-first, pick a nickname and avatar, answer, see results
- **Slide types**: presenter slide (text, image, video, YouTube), multiple-choice trivia, true/false, type-the-answer, poll, word cloud, rating scale, open-ended, put-in-order
- **Scoring**: speed points and streak bonuses, leaderboard, podium
- **Host controls**: show or hide live results, results on phones, leaderboard, custom end slide, optional timer ("no timer" supported)
- **Theming**: custom logo, colour presets, main, accent, button, background and answer-tile colours, gradient or image backgrounds
- **Accounts** (optional for hosts): save, edit, duplicate and relaunch sessions; past session history
- **Media**: upload images or paste links for questions and answers

## How it works

```text
 Phones (players)          Big screen (host)
        \                      /
         \   realtime updates /
          v                  v
        +----------------------+        +--------------------------+
        |  huddle web server   | <----> |  Supabase                |
        |  (Node, this repo)   |        |  Postgres + Auth +       |
        |  pages + server fns  |        |  Realtime + Storage      |
        +----------------------+        +--------------------------+
```

- The web server renders pages and runs the trusted game logic (joining, answering, scoring, host actions).
- Supabase stores rooms, players and answers, handles sign-in, pushes live updates, and stores uploaded media.

## Quick start with Docker

Requirements: Docker 24+ with Compose v2. Nothing else — the database, sign-in, live updates and file storage all run in the stack.

```bash
git clone <your-fork-url> huddle
cd huddle
docker compose up -d
```

Open <http://localhost:3000> (the first start compiles the app and takes a minute or two).

What happens on first start:

1. `secrets` generates a random database password, JWT secret and API keys into the `huddle-secrets` volume. Nothing secret is stored in the repo or the image.
2. `db`, `auth`, `rest`, `realtime`, `storage` and `kong` (API gateway on port 8000) start.
3. `migrate` applies `drizzle/migrations/*.sql` once each and creates the private `media` bucket.
4. `huddle` builds itself with this install's keys and serves on port 3000.

Optional settings (public URLs, SMTP, Google sign-in, ports): `cp .env.example .env`, edit, then `docker compose up -d`.

Useful commands:

```bash
docker compose logs -f huddle         # follow app logs
docker compose down                   # stop (data kept)
docker compose down -v                # stop and wipe all data + secrets
git pull && docker compose up -d --build   # update
```

### Hosting on a real domain

Set `PUBLIC_APP_URL` (e.g. `https://quiz.example.com`) and `PUBLIC_API_URL` (e.g. `https://api.quiz.example.com`) in `.env`, then point a reverse proxy with HTTPS (Caddy, Nginx, Traefik) at ports 3000 and 8000. Phones need HTTPS for a smooth join experience.

### Backing up

Your data lives in the `huddle-db` and `huddle-storage` volumes; keys in `huddle-secrets`. Back up all three together.

## Using a hosted Supabase project instead (advanced)

1. Create a project at <https://supabase.com> (or [self-host Supabase](https://supabase.com/docs/guides/self-hosting)).
2. **Apply the database schema** — run every file in `drizzle/migrations/` in order (`0000_…` first):
   ```bash
   for f in drizzle/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
   ```
   or paste each file into the Supabase SQL editor.
3. **Create the media bucket** (private):
   ```sql
   insert into storage.buckets (id, name, public, file_size_limit)
   values ('media', 'media', false, 52428800)
   on conflict (id) do nothing;
   ```
4. **Enable Realtime** for `rooms`, `players` and `responses` if the migration did not already (Database -> Replication).
5. Copy the project URL, publishable/anon key and service role key into `.env`.

## Authentication options

Players never sign in. Hosts can use huddle without an account too; an account lets them save sessions.

| Option | Where to configure | Effect |
| --- | --- | --- |
| Email confirmation **off** (default recommendation) | Supabase -> Auth -> Providers -> Email -> turn off "Confirm email" (self-hosted: `GOTRUE_MAILER_AUTOCONFIRM=true`) | Sign-up signs the user in straight away |
| Email confirmation **on** | Turn "Confirm email" on and configure SMTP (Auth -> SMTP, self-hosted: `GOTRUE_SMTP_*`) | Users get a confirmation email first. The app shows "check your inbox" automatically |
| Google sign-in | Enable Google in Supabase Auth with your OAuth client, add your site URL to redirect URLs, then set `ENABLE_GOOGLE_AUTH=true` and rebuild | Shows "Continue with Google" |

Also set **Auth -> URL configuration -> Site URL** to your public URL so email links and password resets land on your site (`/reset-password`).

## Configuration reference

| Variable | Used at | Required | Description |
| --- | --- | --- | --- |
| `SUPABASE_URL` | build + runtime | yes | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | build + runtime | yes | Publishable/anon key (safe for browsers) |
| `SUPABASE_SERVICE_ROLE_KEY` | runtime | yes | Server-only key for trusted game actions. Never expose it |
| `SUPABASE_PROJECT_ID` | build | no | Project ref |
| `ENABLE_GOOGLE_AUTH` | build | no | `true` shows the Google button (default `false`) |
| `DONATE_URL` | build | no | Target of the Sponsor buttons |
| `PORT` | runtime | no | Host port in compose (default `3000`) |

## Local development

```bash
bun install
cp .env.example .env
# also add VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY with the same values
bun run dev          # http://localhost:8080
```

Stack: TanStack Start (React 19, SSR, server functions), Vite, Tailwind CSS v4, Supabase.

## Scaling to large audiences

huddle is designed for **500+ simultaneous players** per room:

- Live updates apply only the row that changed — no full refetch per answer.
- Answers are graded in a single batch when the host reveals, not one write per answer.
- Database indexes cover every hot lookup (room, question, player).
- Reactions travel over lightweight broadcast messages and are never stored.

For big events:

- Check your Supabase plan's **Realtime concurrent connection** and **messages per second** limits. Each player plus the host is one connection. The free tier suits smaller groups; use a paid tier for 500+.
- Run 2+ app containers behind a load balancer if you host many rooms at once (the server is stateless).
- Put the app and Supabase in the same region.

## Security model

- All writes go through server functions that verify a secret host token or player token. Browsers can only **read** room data.
- Correct answers are **not** sent to phones before the reveal; they are stored privately and published at reveal time. Scores are computed at reveal, so players cannot peek at others' results mid-question.
- Saved sessions and profiles are private to their owner (row-level security).
- Uploaded media lives in a private bucket in a per-user folder and is shared through signed links.
- The service role key is only read on the server.

Known trade-offs:

- Anyone who knows a room's ID can watch its public data (question text, nicknames, answers). Room IDs are random UUIDs and never listed.
- In put-in-order slides, the correct order is the order the host typed; a determined player inspecting network traffic could infer it.

Report vulnerabilities privately via GitHub security advisories.

## Project structure

```text
src/
  routes/                 pages (home, join, play, host, create, auth, dashboard, edit)
  components/editor/      session editor (slides, theme, settings)
  components/live/        shared live visuals (charts, word cloud, leaderboard, reactions)
  components/Donate.tsx   sponsor prompt and buttons
  lib/room.functions.ts   trusted server logic: create, join, answer, host actions, grading
  lib/game.ts             slide model and helpers
  lib/theme.ts            theme presets and colour variables
drizzle/migrations/       database schema
Dockerfile, docker-compose.yml
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No confirmation email | Turn off "Confirm email", or configure SMTP. Default Supabase email is heavily rate-limited |
| Google button fails | Enable Google in Supabase Auth and add your URL to redirect URLs, or set `ENABLE_GOOGLE_AUTH=false` |
| Live updates don't arrive | Enable Realtime for `rooms`, `players`, `responses` |
| Uploads fail | Create the private `media` bucket and run `0002_media_storage_policies.sql` |
| "Missing Supabase environment variable" | Set the runtime env vars on the container |
| Changed `.env` but nothing changed | Run `docker compose up -d` again — the app rebuilds itself when URLs or toggles change |
| App container restarting on first start | It is still compiling; check `docker compose logs -f huddle` |

## Supporting the project

huddle is free, ad-free and open source. If it helped your event, please consider sponsoring: <https://github.com/sponsors/orendrasingh>

## License

MIT

---

The code is written with the help of AI but full human involvement.
