-- ============================================================================
-- 044 — Sign-up usernames follow the same rules as edited ones
-- ============================================================================
-- set_profile_username() (007, last redefined in 042) turns the display name
-- into the first username. It never applied the 3–30 character rule that 042
-- enforces on every later change, so a long display name produced e.g. a
-- 38-character "script-alert-1-script-z-a-l-g-o-or-1-1", a short one produced
-- "r" or "cd", and a display name of "Admin" produced the reserved "admin"
-- (the reserved list is only checked on UPDATE).
--
-- Now each candidate is:
--   * cut so that base + "-N" is at most 30 characters, dropping a hyphen
--     left dangling by the cut;
--   * skipped (→ next suffix) when it is shorter than 3 characters, reserved,
--     somebody's current username or somebody's old username (042 history).
--
-- The client preview on the sign-up form (firstFreeHandle/handleCandidate in
-- src/lib/profileHandle.ts) mirrors this exactly; keep them in step.
--
-- Existing usernames are NOT renamed here: they are people's live profile
-- links. 042's validate_profile_username only checks a username when it
-- changes, so old out-of-rule names keep working until their owner edits them.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
  tail text;
BEGIN
  IF NEW.username IS NOT NULL AND NEW.username <> '' THEN
    RETURN NEW;
  END IF;

  base := NULLIF(public.slugify(COALESCE(NEW.display_name, NEW.full_name, '')), '');
  IF base IS NULL THEN
    base := 'user-' || substring(NEW.id::text, 1, 8);
  END IF;

  LOOP
    tail := CASE WHEN suffix > 1 THEN '-' || suffix ELSE '' END;
    candidate := rtrim(left(base, 30 - length(tail)), '-') || tail;
    EXIT WHEN length(candidate) >= 3
          AND NOT candidate = ANY (ARRAY[
            'admin', 'administrator', 'root', 'system', 'support', 'help', 'staff',
            'mod', 'moderator', 'official', 'team', 'wingkingtony', 'wingking',
            'winkingtony', 'me', 'new', 'edit', 'settings', 'login', 'register',
            'null', 'undefined', 'anonymous', 'deleted', 'private', 'unknown'
          ])
          AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate)
          AND NOT EXISTS (SELECT 1 FROM public.profile_username_history WHERE username = candidate);
    suffix := suffix + 1;
  END LOOP;

  NEW.username := candidate;
  RETURN NEW;
END;
$$;
