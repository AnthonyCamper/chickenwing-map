-- Notifications for crawl_like and new_crawl_from_followed_user.
-- Enum values were added in migration 013 (must be a separate transaction).

-- ── 1. Add crawl_id column to notifications ──────────────────────────────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS crawl_id uuid REFERENCES public.wing_crawls(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_crawl_id_idx ON public.notifications(crawl_id);

-- ── 2. Add per-user toggles ──────────────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS crawl_like boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS new_crawl_from_followed_user boolean NOT NULL DEFAULT true;

-- ── 3. Trigger: notify crawl owner when someone likes their crawl ────────
CREATE OR REPLACE FUNCTION public.notify_crawl_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
BEGIN
  SELECT user_id, title INTO v_owner, v_title
  FROM public.wing_crawls WHERE id = NEW.crawl_id;

  IF v_owner IS NOT NULL AND v_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, crawl_id, shop_name)
    VALUES (v_owner, NEW.user_id, 'crawl_like'::public.notification_type, NEW.crawl_id, v_title);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_crawl_like ON public.crawl_likes;
CREATE TRIGGER trg_notify_crawl_like
  AFTER INSERT ON public.crawl_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_crawl_like();

-- ── 4. Trigger: notify followers when an author publishes a new crawl ────
-- Only fires for public crawls; only sends to direct followers.
CREATE OR REPLACE FUNCTION public.notify_new_crawl()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_follower record;
BEGIN
  IF NOT NEW.is_public THEN
    RETURN NEW;
  END IF;

  FOR v_follower IN
    SELECT follower_id FROM public.follows WHERE following_id = NEW.user_id
  LOOP
    INSERT INTO public.notifications (recipient_id, actor_id, type, crawl_id, shop_name)
    VALUES (v_follower.follower_id, NEW.user_id, 'new_crawl_from_followed_user'::public.notification_type, NEW.id, NEW.title);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_crawl ON public.wing_crawls;
CREATE TRIGGER trg_notify_new_crawl
  AFTER INSERT ON public.wing_crawls
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_crawl();
