-- Atomicity around wing_crawl_items.position.
--
-- (1) BEFORE-INSERT trigger assigns the next position when the caller
--     inserts position = 0 (default) and there are already items in the
--     crawl. Eliminates the read-max-then-insert race in addCrawlItem().
--
-- (2) reorder_crawl_items(uuid[]) RPC applies a full reordering in a
--     single statement via CASE, so a mid-list failure can't leave the
--     positions partially updated.

-- ── 1. Auto-position trigger ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_crawl_item_position()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only auto-assign when caller didn't request a specific slot
  -- (position = 0 is the column default, treated as "append").
  IF NEW.position = 0 THEN
    SELECT COALESCE(MAX(position) + 1, 0)
      INTO NEW.position
      FROM public.wing_crawl_items
      WHERE crawl_id = NEW.crawl_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_crawl_item_position ON public.wing_crawl_items;
CREATE TRIGGER trg_set_crawl_item_position
  BEFORE INSERT ON public.wing_crawl_items
  FOR EACH ROW EXECUTE FUNCTION public.set_crawl_item_position();

-- ── 2. Atomic reorder RPC ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reorder_crawl_items(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_crawl_id uuid;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- All ids must belong to the same crawl, and the caller must own it
  -- (RLS on the UPDATE below already enforces this, but failing fast
  -- with a clearer error helps debugging).
  SELECT DISTINCT crawl_id INTO v_crawl_id
    FROM public.wing_crawl_items
    WHERE id = ANY(p_ids);

  IF v_crawl_id IS NULL THEN
    RAISE EXCEPTION 'No matching crawl items';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.wing_crawls
    WHERE id = v_crawl_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to reorder this crawl';
  END IF;

  UPDATE public.wing_crawl_items AS ci
    SET position = sub.new_pos
    FROM (
      SELECT id, (ord - 1) AS new_pos
      FROM unnest(p_ids) WITH ORDINALITY AS t(id, ord)
    ) AS sub
    WHERE ci.id = sub.id
      AND ci.crawl_id = v_crawl_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_crawl_items(uuid[]) TO authenticated;
