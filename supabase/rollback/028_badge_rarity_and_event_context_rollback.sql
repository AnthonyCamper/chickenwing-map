-- Rollback 028: restore badges_for_user to its pre-028 shape and drop the
-- badge_earn_stats view.

DROP VIEW IF EXISTS public.badges_for_user;

CREATE VIEW public.badges_for_user WITH (security_invoker = true) AS
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
  ub.earned_at
FROM public.badges b
LEFT JOIN public.user_badges ub
  ON ub.badge_id = b.id AND ub.user_id = auth.uid()
WHERE b.is_active = true
ORDER BY b.sort_order, b.created_at;

GRANT SELECT ON public.badges_for_user TO anon, authenticated;

DROP VIEW IF EXISTS public.badge_earn_stats;
