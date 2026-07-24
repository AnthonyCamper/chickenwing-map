-- ── Ottawa crawl badge theme ───────────────────────────────────────────────
-- The event-seed trigger created generic badge names/emoji for the
-- 2026 Chicken Wing Crawl Ottawa. Re-theme them with Canadian/Ottawa
-- identities. Icon values are keys into the frontend SVG registry
-- (src/components/badges/BadgeIcon.tsx); unknown keys render as text,
-- so these must stay in sync with the registry.

UPDATE badges SET
  name = 'True North',
  description = 'Answered the call — RSVPed to the 2026 Ottawa Chicken Wing Crawl.',
  icon = 'north-star'
WHERE slug = '2026-chicken-wing-crawl-ottawa-rsvp';

UPDATE badges SET
  name = 'Full Canoe',
  description = 'RSVPed with a crew in tow. Every seat paddling.',
  icon = 'canoe'
WHERE slug = '2026-chicken-wing-crawl-ottawa-social';

UPDATE badges SET
  name = 'Puck Drop',
  description = 'First check-in of the entire crawl. You opened the game.',
  icon = 'puck'
WHERE slug = '2026-chicken-wing-crawl-ottawa-early';

UPDATE badges SET
  name = 'The BeaverTail',
  description = 'First stop down. Ottawa invented the pastry; you earned it.',
  icon = 'beavertail'
WHERE slug = '2026-chicken-wing-crawl-ottawa-first';

UPDATE badges SET
  name = 'Double Double',
  description = 'Two stops down, smooth and steady.',
  icon = 'double-double'
WHERE slug = '2026-chicken-wing-crawl-ottawa-two';

UPDATE badges SET
  name = 'Hat Trick',
  description = 'Three stops. The crowd throws hats.',
  icon = 'hat-trick'
WHERE slug = '2026-chicken-wing-crawl-ottawa-three';

UPDATE badges SET
  name = 'The Portage',
  description = 'Four stops deep and still carrying the boat.',
  icon = 'portage'
WHERE slug = '2026-chicken-wing-crawl-ottawa-four';

UPDATE badges SET
  name = 'Question Period',
  description = 'Went on the record with a review during the crawl.',
  icon = 'peace-tower'
WHERE slug = '2026-chicken-wing-crawl-ottawa-review';

UPDATE badges SET
  name = 'The Hansard',
  description = 'Reviewed every stop you checked into. The official record.',
  icon = 'hansard'
WHERE slug = '2026-chicken-wing-crawl-ottawa-all-reviews';

UPDATE badges SET
  name = 'The Full Canal',
  description = 'Every stop, end to end — the full Rideau run.',
  icon = 'skate'
WHERE slug = '2026-chicken-wing-crawl-ottawa-champion';
