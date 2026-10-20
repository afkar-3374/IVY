-- Things the couple has built in their garden with love coins (one of each).
create table public.garden_builds (
  item text primary key,
  built_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  cost int not null check (cost > 0),
  created_at timestamptz default now()
);

alter table public.garden_builds enable row level security;
revoke all on public.garden_builds from anon;

create policy "couple sees builds" on public.garden_builds
  for select to authenticated using (public.is_member());
create policy "couple builds" on public.garden_builds
  for insert to authenticated with check (public.is_member() and built_by = auth.uid());

alter publication supabase_realtime add table public.garden_builds;
