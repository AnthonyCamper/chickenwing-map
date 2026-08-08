-- 033: Explicit check-in unlock time, decoupled from the crawl-day UI.
--
-- 032 anchored the window to the event's local day, so check-ins unlock at
-- local midnight. That is still far earlier than wanted: the crawl-day page
-- should go live in the morning, but check-ins should not open until the
-- crawl actually starts. Split the two — the page keeps using
-- window_opens_at, check-ins use checkins_open_at when set.
--
-- Superseded in part by 034, which makes starts_at the default unlock.

alter table public.events
  add column if not exists checkins_open_at timestamptz;

comment on column public.events.checkins_open_at is
  'Absolute instant check-ins unlock. NULL falls back to the start of the event''s local day. Independent of the crawl-day UI phase.';

-- Ottawa crawl: check-ins unlock 2026-08-08 15:00 EDT (19:00Z).
update public.events set checkins_open_at = timestamptz '2026-08-08 19:00:00+00'
  where id = '0663c3e0-1f6c-424b-8ad6-044652a0a194';

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
      and now() >= coalesce(
            e.checkins_open_at,
            public.event_window_start(e.starts_at, e.timezone)
          )
      and now() <= public.event_window_end(e.starts_at, e.ends_at, e.timezone)
  );
$$;

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
    public.event_window_end(e.starts_at, e.ends_at, e.timezone) as window_closes_at,
    coalesce(
      e.checkins_open_at,
      public.event_window_start(e.starts_at, e.timezone)
    ) as checkins_unlock_at
  from events e;
