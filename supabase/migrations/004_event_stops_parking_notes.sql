ALTER TABLE event_stops ADD COLUMN parking_notes text;

DROP VIEW IF EXISTS event_stops_with_spots;

CREATE VIEW event_stops_with_spots AS
SELECT
  es.id, es.event_id, es.wing_spot_id, es.position,
  es.planned_arrival, es.notes, es.parking_notes, es.created_at,
  ws.name AS spot_name, ws.address AS spot_address,
  ws.lat AS spot_lat, ws.lng AS spot_lng,
  (SELECT COUNT(*)::integer FROM event_checkins ec WHERE ec.event_stop_id = es.id) AS checkin_count
FROM event_stops es
JOIN wing_spots ws ON ws.id = es.wing_spot_id;
