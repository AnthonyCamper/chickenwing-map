-- 028: Badge rarity stats + event context
--
-- 1. badge_earn_stats — one row per active badge with how many members have
--    earned it and how many approved members exist, so the UI can show
--    "Rare — 4 of 34 members have this". security_invoker per 022 conventions;
--    user_badges and profiles are already readable by approved users (or when
--    the site is public), which matches everywhere badges are visible.
-- 2. badges_for_user — appends earned_count / member_count / event_name /
--    event_slug so the unlock popup and badge modals can show rarity and
--    "Earned at <event>" without extra queries.

CREATE VIEW public.badge_earn_stats WITH (security_invoker = true) AS
SELECT
  b.id AS badge_id,
  COUNT(ub.id)::int AS earned_count,
  (SELECT COUNT(*)::int FROM public.profiles p WHERE p.status = 'approved') AS member_count
FROM public.badges b
LEFT JOIN public.user_badges ub ON ub.badge_id = b.id
WHERE b.is_active = true
GROUP BY b.id;

GRANT SELECT ON public.badge_earn_stats TO anon, authenticated;

-- CREATE OR REPLACE only appends columns, preserving the existing shape.
CREATE OR REPLACE VIEW public.badges_for_user WITH (security_invoker = true) AS
SELECT
  b.id,
  b.slug,
  b.name,
  b.description,
  b.icon,
  b.color,
  b.criteria_type,
  b.criteria_config,
  b.event_id,
  b.sort_order,
  (ub.earned_at IS NOT NULL) AS earned,
  ub.earned_at,
  st.earned_count,
  st.member_count,
  e.name AS event_name,
  e.slug AS event_slug
FROM public.badges b
LEFT JOIN public.user_badges ub
  ON ub.badge_id = b.id AND ub.user_id = auth.uid()
LEFT JOIN public.badge_earn_stats st
  ON st.badge_id = b.id
LEFT JOIN public.events e
  ON e.id = b.event_id
WHERE b.is_active = true
ORDER BY b.sort_order, b.created_at;
