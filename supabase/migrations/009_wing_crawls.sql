-- Phase 2 of the Letterboxd-style growth plan: Crawls (Lists).
-- A wing_crawl is a user-curated list of wing spots (e.g. "Best Hot Wings
-- in Brooklyn 2026"). Items can be ordered (is_ranked=true) or unordered.

-- ── 1. wing_crawls table ─────────────────────────────────────────────────
CREATE TABLE public.wing_crawls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  description     text,
  cover_image_url text,
  is_public       boolean NOT NULL DEFAULT true,
  is_ranked       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX wing_crawls_slug_unique ON public.wing_crawls(slug);
CREATE INDEX wing_crawls_user_id_idx ON public.wing_crawls(user_id);
CREATE INDEX wing_crawls_created_at_idx ON public.wing_crawls(created_at DESC);

-- Reuse the existing updated_at trigger function (from earlier migrations)
CREATE TRIGGER trg_wing_crawls_updated_at
  BEFORE UPDATE ON public.wing_crawls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-generate slug on insert using the shared slugify() helper from
-- migration 007. Collision-resolved by appending -2, -3, ...
CREATE OR REPLACE FUNCTION public.set_crawl_slug()
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

  base := NULLIF(public.slugify(NEW.title), '');
  IF base IS NULL THEN
    base := 'crawl-' || substring(NEW.id::text, 1, 8);
  END IF;

  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.wing_crawls WHERE slug = candidate);
    suffix := suffix + 1;
    candidate := base || '-' || suffix;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_crawl_slug
  BEFORE INSERT ON public.wing_crawls
  FOR EACH ROW EXECUTE FUNCTION public.set_crawl_slug();

-- ── 2. wing_crawl_items table ────────────────────────────────────────────
CREATE TABLE public.wing_crawl_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_id      uuid NOT NULL REFERENCES public.wing_crawls(id) ON DELETE CASCADE,
  wing_spot_id  uuid NOT NULL REFERENCES public.wing_spots(id) ON DELETE CASCADE,
  position      integer NOT NULL DEFAULT 0,
  note          text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crawl_id, wing_spot_id)
);

CREATE INDEX wing_crawl_items_crawl_position_idx
  ON public.wing_crawl_items(crawl_id, position);

-- ── 3. Row-level security ────────────────────────────────────────────────
ALTER TABLE public.wing_crawls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wing_crawl_items ENABLE ROW LEVEL SECURITY;

-- wing_crawls: public-or-owner can read; owner-only writes
CREATE POLICY "Crawls: public or owner can read"
  ON public.wing_crawls FOR SELECT
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Crawls: owner can insert"
  ON public.wing_crawls FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crawls: owner can update"
  ON public.wing_crawls FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Crawls: owner can delete"
  ON public.wing_crawls FOR DELETE
  USING (user_id = auth.uid());

-- wing_crawl_items: inherits visibility/permissions from parent crawl
CREATE POLICY "Crawl items: read via parent"
  ON public.wing_crawl_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.wing_crawls c
    WHERE c.id = wing_crawl_items.crawl_id
      AND (c.is_public = true OR c.user_id = auth.uid())
  ));

CREATE POLICY "Crawl items: owner can insert"
  ON public.wing_crawl_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.wing_crawls c
    WHERE c.id = wing_crawl_items.crawl_id
      AND c.user_id = auth.uid()
  ));

CREATE POLICY "Crawl items: owner can update"
  ON public.wing_crawl_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.wing_crawls c
    WHERE c.id = wing_crawl_items.crawl_id
      AND c.user_id = auth.uid()
  ));

CREATE POLICY "Crawl items: owner can delete"
  ON public.wing_crawl_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.wing_crawls c
    WHERE c.id = wing_crawl_items.crawl_id
      AND c.user_id = auth.uid()
  ));

-- ── 4. Detailed view with author info + privacy masking ──────────────────
-- Mirrors the masking pattern from event_rsvps_with_profiles (migration 005).
CREATE VIEW public.wing_crawls_detailed AS
SELECT
  c.id,
  c.user_id,
  c.slug,
  c.title,
  c.description,
  c.cover_image_url,
  c.is_public,
  c.is_ranked,
  c.created_at,
  c.updated_at,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN 'Private wing-logger'
    ELSE COALESCE(p.display_name, p.full_name) END AS author_name,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.avatar_url END AS author_avatar,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.username END AS author_username,
  CASE WHEN p.id = auth.uid() THEN false ELSE p.is_private END AS author_is_private,
  (SELECT COUNT(*) FROM public.wing_crawl_items ci WHERE ci.crawl_id = c.id)::integer AS item_count
FROM public.wing_crawls c
JOIN public.profiles p ON p.id = c.user_id;
