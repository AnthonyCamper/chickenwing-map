-- 037: Let trusted backend callers through enforce_profile_privileges().
--
-- 036 pinned privileged columns for anyone where is_admin() is false. That
-- includes service_role and direct postgres connections, which have no JWT
-- and so fail is_admin() — meaning backend/admin-tooling updates to status
-- or is_admin were silently discarded rather than applied.
--
-- Bypass when there is no user identity at all. That is safe: RLS on
-- profiles only grants UPDATE via `auth.uid() = id` (impossible when
-- auth.uid() is null) or `is_admin()`, so the anon role still cannot reach
-- this table. A null auth.uid() therefore means service_role or postgres.

create or replace function public.enforce_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted backend (service_role / postgres) or a real admin: allow.
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  new.is_admin          := old.is_admin;
  new.status            := old.status;
  new.can_leave_reviews := old.can_leave_reviews;
  new.email             := old.email;  -- auth-owned; must not drift
  return new;
end;
$$;
