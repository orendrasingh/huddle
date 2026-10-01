# huddle v2: accounts, themes, slides, media, and host controls

## 1. Accounts and saved sessions

- Sign up / sign in with email + password and Google. Includes a "forgot password" page.
- Each account has a simple profile (display name, avatar).
- New "My sessions" dashboard where you can create, edit, duplicate, delete, and launch saved quizzes.
- The editor autosaves drafts. Players still join without an account.
- Past sessions keep a short results summary (players, top scores).

## 2. Theme customization (per session, with a saved default per host)

- Upload your own logo, shown on the host screen and on players' phones.
- Pick from preset themes or set your own colours (main, accent, background).
- Background can be a solid colour, a gradient, or an uploaded image.
- Live preview in the editor.
- Able to customize the button color

## 3. New slide types

- **Presenter slide**: title, text, image or video, and layout choices (like a PPT slide). No answers.
- **Trivia**: now supports 2–6 answers, true/false, and images on answers.
- **Type answer**: players type the answer, and it's checked against accepted spellings.
- **Poll**: can use image answers.
- **Word cloud**: unchanged.  (with an toggle to show live wall)
- **Scale / rating** (1–5 or 1–10): shows the average and spread.
- **Open-ended**: short text answers shown on a live wall.
- **Puzzle / order**: players put items in the right order. 
- **Custom end slide**: shows a leaderboard, a podium, a custom message or image, or nothing. 

## 4. Media everywhere

- Each question can carry an image, a video (upload or YouTube link), or extra text.
- Answer options can be text, an image, or both.

## 5. Host controls per slide

- **Timer**: off (no time limit, the host moves on) or 5–300 seconds.
- **Live results on the big screen**: on or off (off keeps results hidden until reveal).
- **Results on players' phones**: on or off.
- **Leaderboard after each question**: on or off.
- A session-wide default, which each slide can override.

## 6. Live reactions

- Players tap emoji reactions (heart, laugh, clap, wow, fire), which float up on the host screen.
- The host can turn reactions on or off, with a rate limit to prevent spam.

## Technical details

- Auth: `profiles` table + signup trigger, email auth + Google enabled, `_authenticated/` routes (`/dashboard`, `/edit/$quizId`), and `/auth` and `/reset-password` pages.
- A `quizzes` table (owner_id, title, theme jsonb, settings jsonb, slides jsonb, timestamps). RLS lets owners only. Rooms store a snapshot of the quiz, theme, and settings plus an optional owner_id.
- Storage bucket `media` (public read, owner-scoped write) for logos, backgrounds, and slide/answer images and videos.
- The Question model becomes a Slide union with `media`, `options[{text,image}]`, `timeLimit: number|null`, and per-slide `showLiveResults/showOnPlayers/showLeaderboard`.
- Theme is applied through CSS variables on the host and player root elements.
- Reactions go over Realtime broadcast (not saved), with a client-side throttle.
- Server scoring gets extended for type-answer, scale, and order slides. A null timer skips the time-up check.