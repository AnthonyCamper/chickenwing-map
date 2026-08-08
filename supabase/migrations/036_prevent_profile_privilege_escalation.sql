-- 036: Stop self-service privilege escalation on profiles.
--
-- "Profiles: users can update own profile" was USING/WITH CHECK
-- (auth.uid() = id) with no column restrictions. RLS cannot express
-- "these columns are off limits", so any signed-in user could PATCH
-- their own row with the public anon key and set:
--   is_admin = true            -> full admin (approve users, delete any
--                                 review, edit any profile, bypass the
--                                 check-in window, manage badges/settings)
--   status = 'approved'        -> self-approve past the pending gate
--   can_leave_reviews = true   -> restore revoked review rights
--
-- Verified exploitable as a normal user before this migration.
--
-- Privileged columns are now pinned to their previous values for
-- non-admins. Pinning silently rather than raising, because the client
-- PATCHes whole profile objects and a hard error would break ordinary
-- profile edits.
--
-- See 037: this version also blocked service_role/postgres.

create or replace function public.enforce_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  new.is_admin          := old.is_admin;
  new.status            := old.status;
  new.can_leave_reviews := old.can_leave_reviews;
  new.email             := old.email;  -- auth-owned; must not drift
  return new;
end;
$$;

drop trigger if exists enforce_profile_privileges on public.profiles;
create trigger enforce_profile_privileges
  before update on public.profiles
  for each row execute function public.enforce_profile_privileges();
