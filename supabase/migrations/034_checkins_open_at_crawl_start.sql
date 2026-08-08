-- 034: Check-ins unlock when the crawl starts.
--
-- The rule is now simply starts_at: no check-ins before the crawl begins.
-- checkins_open_at remains as an explicit per-event override for the cases
-- where the unlock time differs from the advertised start.

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
      and now() >= coalesce(e.checkins_open_at, e.starts_at)
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
    coalesce(e.checkins_open_at, e.starts_at) as checkins_unlock_at
  from events e;
