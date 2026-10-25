-- Our 3D world: where each build stands, which way it faces and how big it is.
-- Empty means "its default spot".
alter table public.garden_builds
  add column x real,
  add column z real,
  add column rot real not null default 0,
  add column size real not null default 1 check (size between 0.4 and 3);

-- Either of you can move things around, but only the layout columns
revoke update on public.garden_builds from authenticated;
grant update (x, z, rot, size) on public.garden_builds to authenticated;

create policy "couple arranges builds" on public.garden_builds
  for update to authenticated using (public.is_member()) with check (public.is_member());
