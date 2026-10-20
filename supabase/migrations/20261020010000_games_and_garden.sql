-- Games, love points (weekly scores, garden growth) and live tic-tac-toe.

-- Every point earned. `ref` makes awards idempotent (one award per thing per person).
create table public.love_points (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  source text not null check (source in ('tap', 'hug', 'daily_question', 'know_me', 'would_you_rather', 'tic_tac_toe', 'garden')),
  points int not null check (points between 1 and 50),
  ref text not null,
  created_at timestamptz default now(),
  unique (user_id, ref)
);
create index idx_love_points_created_at on public.love_points(created_at);

-- Answers for the daily games; `answer` is encrypted by the client
create table public.game_answers (
  id uuid primary key default uuid_generate_v4(),
  game text not null check (game in ('daily_question', 'know_me', 'would_you_rather')),
  round_key text not null,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  answer text not null,
  created_at timestamptz default now(),
  unique (game, round_key, user_id)
);

-- One shared tic-tac-toe board
create table public.tic_tac_toe (
  id int primary key default 1 check (id = 1),
  round int not null default 0,
  board text not null default '---------' check (board ~ '^[-XO]{9}$'),
  x_player uuid references public.profiles(id),
  turn uuid references public.profiles(id),
  status text not null default 'idle' check (status in ('idle', 'playing', 'won', 'draw')),
  winner uuid references public.profiles(id),
  updated_at timestamptz default now()
);
insert into public.tic_tac_toe (id) values (1);

alter table public.love_points enable row level security;
alter table public.game_answers enable row level security;
alter table public.tic_tac_toe enable row level security;
revoke all on public.love_points, public.game_answers, public.tic_tac_toe from anon;

create policy "couple reads points" on public.love_points
  for select to authenticated using (public.is_member());
create policy "earn own points" on public.love_points
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());

create policy "couple reads answers" on public.game_answers
  for select to authenticated using (public.is_member());
create policy "answer as self" on public.game_answers
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());

create policy "couple reads board" on public.tic_tac_toe
  for select to authenticated using (public.is_member());
create policy "couple plays board" on public.tic_tac_toe
  for update to authenticated using (public.is_member()) with check (public.is_member());

alter publication supabase_realtime add table public.love_points, public.game_answers, public.tic_tac_toe;
