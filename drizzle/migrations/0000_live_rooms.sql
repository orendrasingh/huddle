create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  pin text not null unique,
  title text not null default 'Untitled',
  questions jsonb not null default '[]'::jsonb,
  current_index int not null default -1,
  phase text not null default 'lobby',
  question_started_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.rooms to anon, authenticated;
grant all on public.rooms to service_role;
alter table public.rooms enable row level security;
create policy "rooms readable" on public.rooms for select to anon, authenticated using (true);

create table public.room_secrets (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  host_token text not null
);
grant all on public.room_secrets to service_role;
alter table public.room_secrets enable row level security;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null,
  avatar text not null default '🙂',
  score int not null default 0,
  streak int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.players to anon, authenticated;
grant all on public.players to service_role;
alter table public.players enable row level security;
create policy "players readable" on public.players for select to anon, authenticated using (true);

create table public.player_secrets (
  player_id uuid primary key references public.players(id) on delete cascade,
  token text not null
);
grant all on public.player_secrets to service_role;
alter table public.player_secrets enable row level security;

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  question_index int not null,
  answer text not null,
  is_correct boolean,
  points int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.responses(room_id, question_index);
grant select on public.responses to anon, authenticated;
grant all on public.responses to service_role;
alter table public.responses enable row level security;
create policy "responses readable" on public.responses for select to anon, authenticated using (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.responses;