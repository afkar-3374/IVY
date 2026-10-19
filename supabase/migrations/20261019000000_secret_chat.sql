-- Ivy secret chat: private two-person schema.
-- Only the two auth users listed in public.profiles can read or write anything.
-- Message content, nicknames, "about" and avatars are end-to-end encrypted by the
-- client before they reach this database; the server only ever stores ciphertext.

create extension if not exists "uuid-ossp";

-- 1. Profiles (one row per partner, id = auth.users.id)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text unique not null check (role in ('afkar', 'princess')),
  display_name text not null,
  nickname text default '',
  about text default '',
  avatar_url text default '',
  wallpaper text default 'botanical',
  theme text default 'rose',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Per-user wrapped copy of the shared encryption key (readable only by its owner)
create table public.key_vault (
  user_id uuid primary key references auth.users(id) on delete cascade,
  salt text not null,
  iv text not null,
  wrapped_key text not null,
  iterations int not null,
  created_at timestamptz default now()
);

-- 3. Messages
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  local_uuid varchar(64) unique not null,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  content text not null,
  message_type varchar(20) default 'text',
  reply_to varchar(64),
  edited boolean default false,
  edited_at timestamptz,
  deleted boolean default false,
  deleted_at timestamptz,
  pinned boolean default false,
  starred boolean default false,
  forwarded boolean default false,
  status varchar(20) default 'sent',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_messages_created_at on public.messages(created_at);

-- 4. Reactions
create table public.message_reactions (
  id uuid primary key default uuid_generate_v4(),
  message_id varchar(64) not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji varchar(20) not null,
  created_at timestamptz default now()
);
create index idx_reactions_message_id on public.message_reactions(message_id);

-- 5. Membership check used by every policy
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;
revoke all on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;

-- 6. Row level security: nothing for anon, only the couple for authenticated
alter table public.profiles enable row level security;
alter table public.key_vault enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;

revoke all on public.profiles, public.key_vault, public.messages, public.message_reactions from anon;

create policy "couple reads profiles" on public.profiles
  for select to authenticated using (public.is_member());
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "read own key" on public.key_vault
  for select to authenticated using (user_id = auth.uid());

create policy "couple reads messages" on public.messages
  for select to authenticated using (public.is_member());
create policy "send as self" on public.messages
  for insert to authenticated with check (public.is_member() and sender_id = auth.uid());
create policy "couple updates messages" on public.messages
  for update to authenticated using (public.is_member()) with check (public.is_member());

create policy "couple reads reactions" on public.message_reactions
  for select to authenticated using (public.is_member());
create policy "react as self" on public.message_reactions
  for insert to authenticated with check (public.is_member() and profile_id = auth.uid());
create policy "remove own reaction" on public.message_reactions
  for delete to authenticated using (profile_id = auth.uid());

-- 7. Realtime: table changes (filtered by RLS) + private broadcast/presence channels
alter publication supabase_realtime add table public.messages, public.message_reactions, public.profiles;

create policy "couple receives realtime" on realtime.messages
  for select to authenticated using (public.is_member());
create policy "couple sends realtime" on realtime.messages
  for insert to authenticated with check (public.is_member());

-- 8. Private media bucket (files are encrypted client-side before upload)
insert into storage.buckets (id, name, public)
values ('ivy-media', 'ivy-media', false)
on conflict (id) do update set public = false;

create policy "couple reads media" on storage.objects
  for select to authenticated using (bucket_id = 'ivy-media' and public.is_member());
create policy "couple uploads media" on storage.objects
  for insert to authenticated with check (bucket_id = 'ivy-media' and public.is_member());
