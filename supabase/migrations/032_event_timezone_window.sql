-- 032: Anchor the check-in window to the event's own timezone
--
-- 029 gated check-ins with date_trunc('day', e.starts_at). starts_at is a
-- timestamptz and the DB session runs in UTC, so the truncation landed on
-- the UTC day: the Ottawa crawl (2026-08-08 15:00Z = 11:00 EDT) unlocked at
-- 2026-08-08 00:00Z — 20:00 EDT the night before, ~15 hours early. A
-- throwaway account used that gap to check into all five stops the previous
-- evening. The client had the mirror-image bug: eventPhase() derived the day
-- from the *browser's* timezone, so anyone at or east of UTC was shown the
-- crawl-day UI just as early.
--
-- Fix: store the event's timezone and resolve the window against it, then
-- publish the resolved instants on events_with_counts so the client gates on
-- exactly the values the RLS policy enforces instead of recomputing them.
--
-- This does NOT stop a remote check-in during the real window — nothing
-- verifies proximity. That needs a geofence, tracked separately.

alter table public.events
  add column if not exists timezone text not null default 'America/Toronto';

comment on column public.events.timezone is
  'IANA timezone the event''s local day is resolved against (check-in window, crawl-day UI).';

-- Existing rows: the DC crawl is Eastern US, Ottawa takes the default.
update public.events set timezone = 'America/New_York'
  where id = 'd34cb363-b84f-4f6d-98d7-7161cc747210';

-- Start of the event's local day. STABLE, not IMMUTABLE: `at time zone` with
-- a named zone depends on the tzdata in the server.
create or replace function public.event_window_start(
  p_starts_at timestamptz,
  p_timezone text
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_starts_at is null then null
    else date_trunc('day', p_starts_at at time zone coalesce(nullif(p_timezone, ''), 'America/Toronto'))
           at time zone coalesce(nullif(p_timezone, ''), 'America/Toronto')
  end;
$$;

-- ends_at when set, otherwise the last second of that same local day.
create or replace function public.event_window_end(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text
)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case
    when p_ends_at is not null then p_ends_at
    when p_starts_at is null then null
    else public.event_window_start(p_starts_at, p_timezone)
           + interval '1 day' - interval '1 second'
  end;
$$;

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
      and now() >= public.event_window_start(e.starts_at, e.timezone)
      and now() <= public.event_window_end(e.starts_at, e.ends_at, e.timezone)
  );
$$;

-- Publish the resolved window so the client stops deriving it from the
-- browser clock. New columns are appended so create-or-replace accepts them.
-- security_invoker MUST be restated: dropping it would make this a definer
-- view and expose unpublished events to anon through the RLS on events.
create or replace view public.events_with_counts
with (security_invoker = true) as
  select e.id,
    e.slug,
    e.name,
    e.description,
    e.cover_image_url,
    e.starts_at,
    e.ends_at,
    e.is_published,
    e.created_by,
    e.created_at,
    e.updated_at,
    ( select count(*)::integer from event_stops s where s.event_id = e.id) as stop_count,
    ( select count(*)::integer from event_rsvps r where r.event_id = e.id and r.status = 'going'::text) as going_count,
    ( select count(*)::integer from event_rsvps r where r.event_id = e.id and r.status = 'maybe'::text) as maybe_count,
    e.timezone,
    public.event_window_start(e.starts_at, e.timezone) as window_opens_at,
    public.event_window_end(e.starts_at, e.ends_at, e.timezone) as window_closes_at
  from events e;
