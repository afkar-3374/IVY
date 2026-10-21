-- When a message reached the partner's phone and when they read it (for "Message info")
alter table public.messages
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

create or replace function public.stamp_message_receipts()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    if lower(new.status) = 'delivered' then
      new.delivered_at := coalesce(new.delivered_at, old.delivered_at, now());
    elsif lower(new.status) = 'read' then
      new.delivered_at := coalesce(new.delivered_at, old.delivered_at, now());
      new.read_at := coalesce(new.read_at, old.read_at, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_message_receipts on public.messages;
create trigger stamp_message_receipts
  before update of status on public.messages
  for each row execute function public.stamp_message_receipts();
