-- 029: Check-in date gating + public event preview
--
-- 1. Check-ins are only accepted during the event window (start of the
--    starts_at day through ends_at, or end of that day). Badge award
--    triggers fire on insert, so gating inserts gates event badges too.
--    Admins bypass for testing.
-- 2. Published events become readable by logged-out visitors (share-link
--    preview) independent of the site-wide public toggle: the event row,
--    its stops, its event-scoped badges, and an aggregate going-count.
--    No anon access to rsvp rows, check-ins, user_badges, or profiles.

-- Event window helper used by the insert policy
create or replace function public.event_window_open(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from events e
    where e.id = p_event_id
      and e.starts_at is not null
      and now() >= date_trunc('day', e.starts_at)
      and now() <= coalesce(e.ends_at, date_trunc('day', e.starts_at) + interval '1 day' - interval '1 second')
  );
$$;

drop policy if exists "Users insert own checkin" on public.event_checkins;
create policy "Users insert own checkin during event window"
  on public.event_checkins
  for insert
  with check (
    is_approved()
    and user_id = auth.uid()
    and (is_admin() or event_window_open(event_id))
  );

-- Public preview: published events readable without a session
create policy "Published events publicly readable"
  on public.events
  for select
  using (is_published = true);

create policy "Stops of published events publicly readable"
  on public.event_stops
  for select
  using (
    exists (
      select 1 from events e
      where e.id = event_stops.event_id and e.is_published = true
    )
  );

create policy "Badges of published events publicly readable"
  on public.badges
  for select
  using (
    event_id is not null
    and exists (
      select 1 from events e
      where e.id = badges.event_id and e.is_published = true
    )
  );

-- Aggregate going-count for anon preview (never exposes rsvp rows)
create or replace function public.event_going_count(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from event_rsvps
  where event_id = p_event_id and status = 'going';
$$;

grant execute on function public.event_going_count(uuid) to anon, authenticated;
grant execute on function public.event_window_open(uuid) to anon, authenticated;
