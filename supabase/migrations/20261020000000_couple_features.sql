-- Couple features: relationship start date, special dates, moods and love taps/hugs.
-- Text values (start date, date titles/dates, moods) are encrypted by the client.

alter table public.profiles add column mood text default '';

-- Single row shared by the couple
create table public.couple (
  id int primary key default 1 check (id = 1),
  started_on text default '',
  updated_at timestamptz default now()
);
insert into public.couple (id) values (1);

create table public.special_dates (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  date text not null,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz default now()
);

-- Love taps and completed hugs (no content, just who and when)
create table public.love_taps (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'tap' check (kind in ('tap', 'hug')),
  created_at timestamptz default now()
);
create index idx_love_taps_created_at on public.love_taps(created_at);

alter table public.couple enable row level security;
alter table public.special_dates enable row level security;
alter table public.love_taps enable row level security;
revoke all on public.couple, public.special_dates, public.love_taps from anon;

create policy "couple reads couple" on public.couple
  for select to authenticated using (public.is_member());
create policy "couple updates couple" on public.couple
  for update to authenticated using (public.is_member()) with check (public.is_member());

create policy "couple reads dates" on public.special_dates
  for select to authenticated using (public.is_member());
create policy "couple adds dates" on public.special_dates
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
create policy "couple edits dates" on public.special_dates
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "couple removes dates" on public.special_dates
  for delete to authenticated using (public.is_member());

create policy "couple reads taps" on public.love_taps
  for select to authenticated using (public.is_member());
create policy "send own taps" on public.love_taps
  for insert to authenticated with check (public.is_member() and sender_id = auth.uid());

alter publication supabase_realtime add table public.couple, public.special_dates, public.love_taps;
