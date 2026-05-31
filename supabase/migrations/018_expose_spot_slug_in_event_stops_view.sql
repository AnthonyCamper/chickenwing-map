-- Follow-up to 008: event_stops_with_spots was missed when the gallery and
-- review views picked up ws.slug. EventPage needs spot_slug to link each stop
-- card to /spots/:slug. Appended at the end so CREATE OR REPLACE doesn't
-- choke on column-position changes.

CREATE OR REPLACE VIEW public.event_stops_with_spots AS
SELECT
  es.id, es.event_id, es.wing_spot_id, es.position,
  es.planned_arrival, es.notes, es.parking_notes, es.created_at,
  ws.name AS spot_name, ws.address AS spot_address,
  ws.lat AS spot_lat, ws.lng AS spot_lng,
  (SELECT COUNT(*)::integer FROM public.event_checkins ec WHERE ec.event_stop_id = es.id) AS checkin_count,
  ws.slug AS spot_slug
FROM public.event_stops es
JOIN public.wing_spots ws ON ws.id = es.wing_spot_id;
