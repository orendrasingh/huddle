<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Live rooms snapshot slides, theme and settings as jsonb on `rooms`; saved sessions live in `quizzes` (owner-only RLS). Why: a running room must not change when the host edits the saved copy.
- Uploaded media goes in the private `media` bucket under `<userId>/` and is shared via 10-year signed URLs. Why: public buckets are blocked for this workspace.
- Theme is applied with CSS variables from `themeStyle()` on the host/player root. Why: one skin mechanism for every screen.
- Reactions use Realtime broadcast only (not stored). Why: they're fire-and-forget and high-volume.

- Answer keys live in `room_secrets.questions`; `rooms.questions` has them stripped until reveal, and all grading/scoring happens in one batch at reveal. Why: players can read the room row and responses.
- docker-compose runs a full self-hosted backend; secrets are generated at first start into a volume and the app compiles at container start with them (`NITRO_PRESET=node-server`). Why: zero-config `docker compose up` with no secrets in the repo or image.
