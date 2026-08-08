-- 035: Close the remaining check-in bypasses.
--
-- Found while auditing the path an early check-in took:
--
-- 1. The "RSVP going first" rule was enforced only in EventPage. The insert
--    policy never mentioned RSVPs, so a direct PostgREST call with the
--    public anon key skipped it entirely.
-- 2. The UPDATE policy was `user_id = auth.uid()` with no column limits, so
--    a user could relocate an existing check-in to any other stop or event
--    — manufacturing visits without ever passing the insert window check.
-- 3. checked_in_at was client-supplied, so the recorded time could be
--    falsified (e.g. to claim first check-in) even inside a valid window.
--
-- Badges are safe by comparison: user_badges has no user-facing INSERT
-- policy, so they can only be awarded by the SECURITY DEFINER triggers.

create or replace function public.has_going_rsvp(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from event_rsvps r
    where r.event_id = p_event_id
      and r.user_id = auth.uid()
      and r.status = 'going'
  );
$$;

drop policy if exists "Users insert own checkin during event window" on public.event_checkins;
create policy "Users insert own checkin during event window"
  on public.event_checkins
  for insert
  with check (
    is_approved()
    and user_id = auth.uid()
    and (is_admin() or (event_window_open(event_id) and has_going_rsvp(event_id)))
  );

-- A check-in records where you were and when. Only the review attached to it
-- may change afterwards; everything else is fixed at insert time.
create or replace function public.enforce_checkin_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.checked_in_at := now();
    return new;
  end if;

  if new.event_id      is distinct from old.event_id
  or new.event_stop_id is distinct from old.event_stop_id
  or new.user_id       is distinct from old.user_id then
    raise exception 'A check-in cannot be moved to another stop, event, or user';
  end if;
  new.checked_in_at := old.checked_in_at;
  return new;
end;
$$;

drop trigger if exists enforce_checkin_integrity on public.event_checkins;
create trigger enforce_checkin_integrity
  before insert or update on public.event_checkins
  for each row execute function public.enforce_checkin_integrity();
