-- 038: Let a signed-in user permanently delete their own account.
--
-- Called from Profile → Delete account. Deleting the auth.users row is
-- enough: every table that holds a user's data references auth.users or
-- profiles with ON DELETE CASCADE (checked against the schema when this was
-- written):
--   auth.users → profiles, review/photo/crawl comments, likes, reactions
--   profiles   → reviews (→ review_photos, their likes/comments/reactions),
--                wing_crawls, follows (both sides), event_rsvps,
--                event_checkins, user_badges, notifications (recipient),
--                notification_preferences, push_subscriptions, DMs
-- and the two references that should outlive the user are SET NULL:
--   events.created_by, notifications.actor_id (other people's notifications).
-- Nothing is ON DELETE RESTRICT / NO ACTION, so nothing blocks the delete.
--
-- Files in Storage are not covered by FKs; the client removes the user's own
-- folders (review-photos, user-avatars, crawl-covers) before calling this.
--
-- Admins are refused so the site can't lose its last admin by accident; an
-- admin who really wants out can be demoted first.

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'You need to be signed in to delete your account.'
      using errcode = '28000';
  end if;

  if exists (select 1 from public.profiles where id = v_uid and is_admin) then
    raise exception 'Admin accounts can''t be deleted here. Remove admin rights first.'
      using errcode = '42501';
  end if;

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
