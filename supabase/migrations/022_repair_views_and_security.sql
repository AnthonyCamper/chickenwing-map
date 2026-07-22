-- ============================================================================
-- 022 — Repair core views + security hardening
-- ============================================================================
-- Context: the remotely-applied "fix_review_views_wing_column_names"
-- (2026-06-21) recreated gallery_feed / reviews_with_profiles from a pre-018
-- shape, dropping wing_flavors, spot_slug, spot_lat/lng, reviewer_username and
-- reviewer_is_private — breaking spot links, multi-sauce display and (worst)
-- private-profile masking. This migration:
--   1. Recreates both views exactly per 018_multi_sauce.sql, WITH
--      security_invoker so base-table RLS applies to the querying user.
--   2. Flips the remaining SECURITY DEFINER views to security_invoker
--      (advisor ERROR security_definer_view x13) and widens event/badge read
--      policies with is_site_public() so public browsing keeps working under
--      invoker semantics — and the private-site toggle becomes enforceable.
--   3. Fixes web push: UNIQUE(user_id, endpoint) that the client's upsert
--      requires (every save currently fails) + missing UPDATE policy.
--   4. Locks down notifications INSERT (was WITH CHECK (true) → anyone could
--      forge notifications) and ai_headlines writes (were world-writable).
--      Notification triggers are SECURITY DEFINER owned by postgres, which
--      bypasses RLS, so they are unaffected.
--   5. Enforces approval (is_approved()) on crawl / follow / DM writes and
--      pins content attribution (user_id = auth.uid()) on reviews and
--      review_photos inserts. Avatar uploads get a folder-ownership check
--      (NO approval check: signup uploads an avatar while still pending).
--   6. Adds like/reaction notifications for review_likes / review_reactions
--      (the old triggers sit on the dead legacy photo_likes table).
--   7. Adds hot-path FK indexes and drops duplicate follows policies.
-- Accepted risk (documented): wing_spots UPDATE stays can_review() because
-- createReview upserts spots on (name,address) conflict.
-- ============================================================================

-- ── 1. Core views per 018, with security_invoker ────────────────────────────
DROP VIEW IF EXISTS public.gallery_feed;
DROP VIEW IF EXISTS public.reviews_with_profiles;

CREATE VIEW public.reviews_with_profiles WITH (security_invoker = true) AS
SELECT r.id, r.wing_spot_id, r.user_id, r.overall_rating, r.wing_size,
       r.wing_flavor, r.is_takeout, r.takeout_container, r.review_text,
       r.visited_at, r.legacy_data, r.event_id, r.event_stop_id,
       r.created_at, r.updated_at,
       p.display_name AS reviewer_name, p.avatar_url AS reviewer_avatar,
       p.email AS reviewer_email,
       ws.name AS spot_name, ws.address AS spot_address,
       ws.lat AS spot_lat, ws.lng AS spot_lng,
       e.slug AS event_slug, e.name AS event_name,
       ws.slug AS spot_slug, p.username AS reviewer_username,
       p.is_private AS reviewer_is_private, r.wing_flavors
FROM reviews r
JOIN profiles p ON p.id = r.user_id
JOIN wing_spots ws ON ws.id = r.wing_spot_id
LEFT JOIN events e ON e.id = r.event_id;

CREATE VIEW public.gallery_feed WITH (security_invoker = true) AS
SELECT rp.id AS photo_id, rp.url AS photo_url, rp.display_order,
       rp.created_at AS photo_created_at, rp.review_id,
       r.wing_spot_id, r.overall_rating, r.wing_flavor, r.review_text,
       r.visited_at, r.user_id AS reviewer_id, r.event_id,
       ws.name AS spot_name, ws.address AS spot_address,
       COALESCE(p.display_name, p.full_name) AS reviewer_name,
       p.avatar_url AS reviewer_avatar, p.email AS reviewer_email,
       COALESCE(lk.cnt, 0) AS like_count, COALESCE(cm.cnt, 0) AS comment_count,
       e.slug AS event_slug, e.name AS event_name,
       CASE WHEN auth.uid() IS NOT NULL THEN
         (EXISTS (SELECT 1 FROM review_likes rl WHERE rl.review_id = r.id AND rl.user_id = auth.uid()))
       ELSE false END AS is_liked_by_me,
       ws.slug AS spot_slug, p.username AS reviewer_username,
       p.is_private AS reviewer_is_private, r.wing_flavors
FROM review_photos rp
JOIN reviews r ON rp.review_id = r.id
JOIN wing_spots ws ON r.wing_spot_id = ws.id
JOIN profiles p ON r.user_id = p.id
LEFT JOIN events e ON e.id = r.event_id
LEFT JOIN LATERAL (SELECT count(*)::integer AS cnt FROM review_likes WHERE review_likes.review_id = r.id) lk ON true
LEFT JOIN LATERAL (SELECT count(*)::integer AS cnt FROM review_comments WHERE review_comments.review_id = r.id) cm ON true
ORDER BY rp.created_at DESC;

GRANT SELECT ON public.reviews_with_profiles TO anon, authenticated;
GRANT SELECT ON public.gallery_feed TO anon, authenticated;

-- ── 2. Flip remaining definer views to invoker ──────────────────────────────
ALTER VIEW public.crawl_comments_detailed   SET (security_invoker = true);
ALTER VIEW public.dm_threads_with_profiles  SET (security_invoker = true);
ALTER VIEW public.event_rsvps_with_profiles SET (security_invoker = true);
ALTER VIEW public.event_stops_with_spots    SET (security_invoker = true);
ALTER VIEW public.following_feed            SET (security_invoker = true);
ALTER VIEW public.follows_with_profiles     SET (security_invoker = true);
ALTER VIEW public.leaderboard_stats         SET (security_invoker = true);
ALTER VIEW public.public_profiles           SET (security_invoker = true);
ALTER VIEW public.social_feed               SET (security_invoker = true);
ALTER VIEW public.user_posts_grid           SET (security_invoker = true);
ALTER VIEW public.wing_crawls_detailed      SET (security_invoker = true);

-- Event/badge reads must honor the public-site toggle now that the views run
-- as the caller (they previously leaked through definer views for anon).
DROP POLICY "Approved users can read events" ON public.events;
CREATE POLICY "Events: readable by approved users or public" ON public.events
  FOR SELECT USING (is_site_public() OR is_approved() OR is_admin());
DROP POLICY "Approved users can read event stops" ON public.event_stops;
CREATE POLICY "Event stops: readable by approved users or public" ON public.event_stops
  FOR SELECT USING (is_site_public() OR is_approved() OR is_admin());
DROP POLICY "Approved users can read rsvps" ON public.event_rsvps;
CREATE POLICY "RSVPs: readable by approved users or public" ON public.event_rsvps
  FOR SELECT USING (is_site_public() OR is_approved() OR is_admin());
DROP POLICY "Approved users can read badges" ON public.badges;
CREATE POLICY "Badges: readable by approved users or public" ON public.badges
  FOR SELECT USING (is_site_public() OR is_approved() OR is_admin());
DROP POLICY "Approved users can read user badges" ON public.user_badges;
CREATE POLICY "User badges: readable by approved users or public" ON public.user_badges
  FOR SELECT USING (is_site_public() OR is_approved() OR is_admin());

-- ── 3. Web push repair ──────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_user_endpoint_key') THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint);
  END IF;
END $$;
CREATE POLICY "Push subs: users can update own" ON public.push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 4. Lock down forgeable writes ───────────────────────────────────────────
DROP POLICY "Notifications: system can insert" ON public.notifications;
DROP POLICY ai_headlines_public_insert ON public.ai_headlines;
DROP POLICY ai_headlines_public_update ON public.ai_headlines;
DROP POLICY ai_headlines_public_delete ON public.ai_headlines;

-- ── 5. Approval enforcement + attribution pinning ───────────────────────────
DROP POLICY "Crawls: owner can insert" ON public.wing_crawls;
CREATE POLICY "Crawls: approved owner can insert" ON public.wing_crawls
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved());

DROP POLICY "Crawl items: owner can insert" ON public.wing_crawl_items;
CREATE POLICY "Crawl items: approved owner can insert" ON public.wing_crawl_items
  FOR INSERT WITH CHECK (is_approved() AND EXISTS (
    SELECT 1 FROM wing_crawls c WHERE c.id = wing_crawl_items.crawl_id AND c.user_id = auth.uid()));

DROP POLICY "Crawl comments: insert self on readable crawl" ON public.crawl_comments;
CREATE POLICY "Crawl comments: approved self on readable crawl" ON public.crawl_comments
  FOR INSERT WITH CHECK (is_approved() AND user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM wing_crawls c WHERE c.id = crawl_comments.crawl_id
      AND (c.is_public = true OR c.user_id = auth.uid())));

DROP POLICY "Crawl likes: insert own" ON public.crawl_likes;
CREATE POLICY "Crawl likes: approved insert own" ON public.crawl_likes
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved());

DROP POLICY "Crawl comment likes: insert self" ON public.crawl_comment_likes;
CREATE POLICY "Crawl comment likes: approved insert self" ON public.crawl_comment_likes
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved());

DROP POLICY "Crawl comment reactions: insert self" ON public.crawl_comment_reactions;
CREATE POLICY "Crawl comment reactions: approved insert self" ON public.crawl_comment_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid() AND is_approved());

-- follows: drop exact duplicates, enforce approval on insert
DROP POLICY follows_select_all ON public.follows;
DROP POLICY follows_insert ON public.follows;
DROP POLICY follows_delete ON public.follows;
DROP POLICY follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows
  FOR INSERT WITH CHECK (follower_id = auth.uid() AND is_approved());

-- DMs: approval required to open threads / send
DROP POLICY dm_threads_insert ON public.direct_message_threads;
CREATE POLICY dm_threads_insert ON public.direct_message_threads
  FOR INSERT WITH CHECK (is_approved()
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
    AND (user1_id::text < user2_id::text));
DROP POLICY dm_messages_insert ON public.direct_messages;
CREATE POLICY dm_messages_insert ON public.direct_messages
  FOR INSERT WITH CHECK (is_approved() AND sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM direct_message_threads t
    WHERE t.id = direct_messages.thread_id
      AND (t.user1_id = auth.uid() OR t.user2_id = auth.uid())));

-- Attribution pinning
DROP POLICY "Reviews: approved reviewers can insert" ON public.reviews;
CREATE POLICY "Reviews: approved reviewers can insert" ON public.reviews
  FOR INSERT WITH CHECK (can_review() AND user_id = auth.uid());

DROP POLICY "Photos: approved reviewers can insert" ON public.review_photos;
CREATE POLICY "Photos: approved reviewers can insert own" ON public.review_photos
  FOR INSERT WITH CHECK (can_review() AND EXISTS (
    SELECT 1 FROM reviews r WHERE r.id = review_photos.review_id AND r.user_id = auth.uid()));

-- Storage: avatar writes scoped to the user's own folder (path is <uid>/avatar.<ext>;
-- upsert:true needs UPDATE too). No approval check — signup uploads while pending.
DROP POLICY "Avatar upload: authenticated users" ON storage.objects;
CREATE POLICY "Avatar upload: own folder" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar update: own folder" ON storage.objects
  FOR UPDATE USING (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'user-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY "Crawl covers: owner upload" ON storage.objects;
CREATE POLICY "Crawl covers: approved owner upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'crawl-covers' AND is_approved()
    AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 6. Review like/reaction notifications ───────────────────────────────────
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_like';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'review_reaction';

CREATE OR REPLACE FUNCTION public.notify_review_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_shop text;
BEGIN
  SELECT r.user_id, ws.name INTO v_owner, v_shop
  FROM public.reviews r JOIN public.wing_spots ws ON ws.id = r.wing_spot_id
  WHERE r.id = NEW.review_id;
  IF v_owner IS NOT NULL AND v_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, review_id, shop_name)
    VALUES (v_owner, NEW.user_id, 'review_like'::public.notification_type, NEW.review_id, v_shop);
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_review_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_owner uuid; v_shop text;
BEGIN
  SELECT r.user_id, ws.name INTO v_owner, v_shop
  FROM public.reviews r JOIN public.wing_spots ws ON ws.id = r.wing_spot_id
  WHERE r.id = NEW.review_id;
  IF v_owner IS NOT NULL AND v_owner != NEW.user_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
    VALUES (v_owner, NEW.user_id, 'review_reaction'::public.notification_type, NEW.review_id, v_shop, NEW.reaction_type);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_review_like ON public.review_likes;
CREATE TRIGGER trg_notify_review_like
  AFTER INSERT ON public.review_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_review_like();

DROP TRIGGER IF EXISTS trg_notify_review_reaction ON public.review_reactions;
CREATE TRIGGER trg_notify_review_reaction
  AFTER INSERT ON public.review_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_review_reaction();

-- ── 7. Hot-path FK indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_review_photos_review_id ON public.review_photos(review_id);
CREATE INDEX IF NOT EXISTS idx_reviews_wing_spot_id    ON public.reviews(wing_spot_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id         ON public.reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_review_likes_user_id    ON public.review_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_review_id ON public.notifications(review_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id  ON public.notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id    ON public.follows(following_id);
