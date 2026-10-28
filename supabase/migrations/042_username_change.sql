-- ============================================================================
-- 042 — Let members change their username (profile link /u/<username>)
-- ============================================================================
-- The username was made once from the first display name (007 trigger) and
-- could not be changed in the app. RLS already let a user PATCH their own
-- profiles.username to ANY text (spaces, capitals, "admin", 1 character), so
-- this adds the missing server-side rules and makes changing it safe:
--
--   1. validate_profile_username(): on UPDATE, a changed username must be
--      3–30 characters of a–z, 0–9 and single hyphens (the same shape
--      slugify() makes), must not be a reserved word, and must not be
--      somebody else's old username (see 2), and a member may rename at
--      most 3 times in 30 days (old names stay reserved to them). Trusted backend callers
--      (auth.uid() is null: service_role / postgres) are not checked.
--   2. profile_username_history: every old username is kept, linked to its
--      owner, so old shared links can be sent on to the new one and nobody
--      else can take an old name over and receive those links.
--
-- Error messages start with "username:" so the client can tell them apart.
-- Uniqueness is still the existing profiles_username_unique constraint
-- (SQLSTATE 23505).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profile_username_history (
  username   text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profile_username_history_user_idx
  ON public.profile_username_history (user_id);

ALTER TABLE public.profile_username_history ENABLE ROW LEVEL SECURITY;

-- Readable exactly where profiles are (old links are public anyway). No
-- write policies: only the SECURITY DEFINER trigger below writes here.
DROP POLICY IF EXISTS "Username history: readable like profiles" ON public.profile_username_history;
CREATE POLICY "Username history: readable like profiles"
  ON public.profile_username_history
  FOR SELECT USING (is_site_public() OR is_approved() OR user_id = auth.uid());

GRANT SELECT ON public.profile_username_history TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NEW.username IS NULL OR length(NEW.username) < 3 OR length(NEW.username) > 30 THEN
      RAISE EXCEPTION 'username: must be 3 to 30 characters' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.username !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
      RAISE EXCEPTION 'username: only a-z, 0-9 and single hyphens' USING ERRCODE = 'check_violation';
    END IF;
    -- Reserved words: admins may use them, and anyone may take back their
    -- own old name.
    IF NOT is_admin()
       AND NOT EXISTS (
         SELECT 1 FROM public.profile_username_history h
         WHERE h.username = NEW.username AND h.user_id = NEW.id
       )
       AND NEW.username = ANY (ARRAY[
      'admin', 'administrator', 'root', 'system', 'support', 'help', 'staff',
      'mod', 'moderator', 'official', 'team', 'wingkingtony', 'wingking',
      'winkingtony', 'me', 'new', 'edit', 'settings', 'login', 'register',
      'null', 'undefined', 'anonymous', 'deleted', 'private', 'unknown'
    ]) THEN
      RAISE EXCEPTION 'username: reserved' USING ERRCODE = 'check_violation';
    END IF;
    -- Old names stay reserved to their owner, so cap how often a member can
    -- rename; otherwise one account could hoard any number of names.
    IF NOT is_admin() AND (
      SELECT count(*) FROM public.profile_username_history h
      WHERE h.user_id = NEW.id AND h.changed_at > now() - interval '30 days'
    ) >= 3 THEN
      RAISE EXCEPTION 'username: too many changes' USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.profile_username_history h
      WHERE h.username = NEW.username AND h.user_id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'username: taken' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Keep the old name so /u/<old> still finds this person.
  IF OLD.username IS NOT NULL AND OLD.username <> '' THEN
    INSERT INTO public.profile_username_history (username, user_id)
    VALUES (OLD.username, OLD.id)
    ON CONFLICT (username) DO UPDATE
      SET user_id = EXCLUDED.user_id, changed_at = now();
  END IF;
  -- Taking back one of your own old names: it is current again.
  DELETE FROM public.profile_username_history
  WHERE username = NEW.username AND user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_username ON public.profiles;
CREATE TRIGGER validate_profile_username
  BEFORE UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();

-- New sign-ups must not be handed someone's old username either (that would
-- hijack their old links). Same loop as 007, also skipping history names.
CREATE OR REPLACE FUNCTION public.set_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username <> '' THEN
    RETURN NEW;
  END IF;

  base := NULLIF(public.slugify(COALESCE(NEW.display_name, NEW.full_name, '')), '');
  IF base IS NULL THEN
    base := 'user-' || substring(NEW.id::text, 1, 8);
  END IF;

  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate)
          AND NOT EXISTS (SELECT 1 FROM public.profile_username_history WHERE username = candidate);
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  NEW.username := candidate;
  RETURN NEW;
END;
$$;
