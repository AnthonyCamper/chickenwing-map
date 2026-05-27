-- Phase 1 of the Letterboxd-style growth plan: add slug-style identifiers to
-- profiles and wing_spots so we can route /u/:username and /spots/:slug.

-- ── 1. Shared slugify helper ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(both '-' FROM regexp_replace(
    regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g'
  ));
$$;

-- ── 2. profiles.username ──────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

WITH src AS (
  SELECT id, NULLIF(public.slugify(COALESCE(display_name, full_name, '')), '') AS base
  FROM public.profiles
), with_fallback AS (
  SELECT id, COALESCE(base, 'user-' || substring(id::text, 1, 8)) AS base FROM src
), numbered AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY id) AS rn FROM with_fallback
)
UPDATE public.profiles p
SET username = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE p.id = n.id AND p.username IS NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

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
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate);
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  NEW.username := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_profile_username ON public.profiles;
CREATE TRIGGER trg_set_profile_username
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profile_username();

-- ── 3. wing_spots.slug ────────────────────────────────────────────────────
ALTER TABLE public.wing_spots
  ADD COLUMN IF NOT EXISTS slug text;

WITH src AS (
  SELECT id, created_at, NULLIF(public.slugify(name), '') AS base FROM public.wing_spots
), with_fallback AS (
  SELECT id, created_at, COALESCE(base, 'spot-' || substring(id::text, 1, 8)) AS base FROM src
), numbered AS (
  SELECT id, base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY created_at) AS rn FROM with_fallback
)
UPDATE public.wing_spots w
SET slug = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE w.id = n.id AND w.slug IS NULL;

ALTER TABLE public.wing_spots
  ADD CONSTRAINT wing_spots_slug_unique UNIQUE (slug);

CREATE OR REPLACE FUNCTION public.set_spot_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  base := NULLIF(public.slugify(NEW.name), '');
  IF base IS NULL THEN
    base := 'spot-' || substring(NEW.id::text, 1, 8);
  END IF;

  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.wing_spots WHERE slug = candidate);
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_spot_slug ON public.wing_spots;
CREATE TRIGGER trg_set_spot_slug
  BEFORE INSERT ON public.wing_spots
  FOR EACH ROW EXECUTE FUNCTION public.set_spot_slug();
