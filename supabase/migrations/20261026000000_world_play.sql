-- Our world, part 2: love points for playing in the world, and each person's wardrobe.

-- Points earned in the world (swing, picnic, car ride…)
alter table public.love_points drop constraint love_points_source_check;
alter table public.love_points add constraint love_points_source_check
  check (source in ('tap', 'hug', 'daily_question', 'know_me', 'would_you_rather', 'tic_tac_toe', 'garden', 'world'));

-- What each of you is wearing, which clothes you own, and the love coins spent on them
create table public.world_avatars (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  look jsonb not null default '{}'::jsonb,
  owned text[] not null default '{}',
  spent int not null default 0 check (spent >= 0),
  updated_at timestamptz default now()
);

alter table public.world_avatars enable row level security;
revoke all on public.world_avatars from anon;

create policy "couple sees avatars" on public.world_avatars
  for select to authenticated using (public.is_member());
create policy "create own avatar" on public.world_avatars
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "dress own avatar" on public.world_avatars
  for update to authenticated using (public.is_member() and user_id = auth.uid()) with check (user_id = auth.uid());

alter publication supabase_realtime add table public.world_avatars;
