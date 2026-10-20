-- Web push subscriptions (one per device). Only the owner can see or change theirs;
-- the send-push function reads the partner's with the service role.
create table public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon;

create policy "own subscriptions read" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "own subscriptions add" on public.push_subscriptions
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
create policy "own subscriptions update" on public.push_subscriptions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own subscriptions remove" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());
