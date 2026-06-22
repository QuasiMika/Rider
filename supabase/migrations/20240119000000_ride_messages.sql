-- ride_messages: in-ride chat between driver and guest
create table public.ride_messages (
  id         uuid primary key default gen_random_uuid(),
  ride_id    uuid not null references public.rides(id) on delete cascade,
  sender_id  uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.ride_messages enable row level security;

-- both participants of the ride may read messages
create policy "ride_messages_select" on public.ride_messages
  for select using (
    exists (
      select 1 from public.rides r
      where r.id = ride_id
        and (r.driver_id = auth.uid() or r.guest_id = auth.uid())
    )
  );

-- only participants may insert, and sender_id must match caller
create policy "ride_messages_insert" on public.ride_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.rides r
      where r.id = ride_id
        and (r.driver_id = auth.uid() or r.guest_id = auth.uid())
        and r.status in ('pending', 'picked_up', 'active')
    )
  );

-- expose to realtime
alter publication supabase_realtime add table public.ride_messages;

-- delete messages when ride is completed or cancelled
create or replace function public.delete_ride_messages_on_end()
returns trigger language plpgsql security definer as $$
begin
  if new.status in ('completed', 'cancelled') and old.status not in ('completed', 'cancelled') then
    delete from public.ride_messages where ride_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_delete_ride_messages
  after update of status on public.rides
  for each row execute function public.delete_ride_messages_on_end();
