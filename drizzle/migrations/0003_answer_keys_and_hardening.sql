alter table public.room_secrets add column if not exists questions jsonb;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create index if not exists responses_room_q_idx on public.responses (room_id, question_index);
create index if not exists responses_player_q_idx on public.responses (player_id, question_index);
create index if not exists players_room_idx on public.players (room_id);