-- ── 0. Expand criteria_type constraint ────────────────────────────────────
ALTER TABLE badges DROP CONSTRAINT badges_criteria_type_check;
ALTER TABLE badges ADD CONSTRAINT badges_criteria_type_check CHECK (criteria_type = ANY (ARRAY[
  'first_review', 'review_count', 'wing_size_variety',
  'event_rsvp', 'event_rsvp_with_guests',
  'event_checkin_count', 'event_complete', 'event_first_checkin',
  'event_review_count', 'event_review_all',
  'unique_spots', 'flavor_variety',
  'lemon_pepper', 'ranch_fan', 'heat_seeker',
  'comment_count', 'avg_rating_high', 'avg_rating_low',
  'perfect_ten', 'takeout_count', 'loyal_regular', 'jumbo_fan'
]));

-- ── 1. Private profiles ────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false;

DROP VIEW IF EXISTS event_rsvps_with_profiles;
CREATE VIEW event_rsvps_with_profiles AS
SELECT
  r.id, r.event_id, r.user_id, r.status, r.guest_count, r.notes, r.created_at, r.updated_at,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN 'Private' ELSE COALESCE(p.display_name, p.full_name) END AS user_name,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.avatar_url END AS user_avatar,
  CASE WHEN p.is_private = true AND p.id != auth.uid()
    THEN NULL ELSE p.email END AS user_email,
  CASE WHEN p.id = auth.uid() THEN false ELSE p.is_private END AS is_private
FROM event_rsvps r
JOIN profiles p ON p.id = r.user_id;

-- ── 2. More event badges for 2026 DC Chicken Wing Crawl ────────────────────
INSERT INTO badges (slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order, is_active)
VALUES
  ('2026-dc-chicken-wing-crawl-two',
   'Warming Up', 'Checked in at 2 stops at the 2026 DC Chicken Wing Crawl',
   '✌️', 'amber', 'event_checkin_count', '{"count": 2}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 22, true),
  ('2026-dc-chicken-wing-crawl-three',
   'On a Roll', 'Checked in at 3 stops at the 2026 DC Chicken Wing Crawl',
   '🔥', 'amber', 'event_checkin_count', '{"count": 3}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 24, true),
  ('2026-dc-chicken-wing-crawl-four',
   'Wing Veteran', 'Checked in at 4 stops at the 2026 DC Chicken Wing Crawl',
   '🪖', 'amber', 'event_checkin_count', '{"count": 4}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 26, true),
  ('2026-dc-chicken-wing-crawl-review',
   'Critic on Duty', 'Left a review at the 2026 DC Chicken Wing Crawl',
   '📝', 'amber', 'event_review_count', '{"count": 1}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 28, true),
  ('2026-dc-chicken-wing-crawl-all-reviews',
   'Thorough Taster', 'Reviewed every stop you checked into at the 2026 DC Chicken Wing Crawl',
   '📋', 'amber', 'event_review_all', '{}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 29, true),
  ('2026-dc-chicken-wing-crawl-social',
   'Party Starter', 'RSVPed with guests to the 2026 DC Chicken Wing Crawl',
   '🎉', 'amber', 'event_rsvp_with_guests', '{}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 15, true),
  ('2026-dc-chicken-wing-crawl-early',
   'Early Arrival', 'First to check in at any stop of the 2026 DC Chicken Wing Crawl',
   '⚡', 'amber', 'event_first_checkin', '{}',
   'd34cb363-b84f-4f6d-98d7-7161cc747210', 12, true)
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Update award_user_badges with all new criteria types ───────────────
-- (see full function body in migration applied via MCP)

-- ── 4. Update trg_seed_event_badges for future events ─────────────────────
-- (see full function body in migration applied via MCP)

-- ── 5. Backfill badges for all existing approved users ─────────────────────
DO $$
DECLARE uid uuid;
BEGIN
  FOR uid IN SELECT id FROM public.profiles WHERE status = 'approved' LOOP
    PERFORM public.award_user_badges(uid);
  END LOOP;
END;
$$;
