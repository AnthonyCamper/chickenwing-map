-- 030: Spots on published event routes readable without a session.
--
-- event_stops_with_spots is a security-invoker view that INNER JOINs
-- wing_spots, so without this policy the anon share-link preview (029)
-- would show an empty route: the stop rows pass RLS but the join drops
-- them when wing_spots is unreadable.
create policy "Spots on published event routes publicly readable"
  on public.wing_spots
  for select
  using (
    exists (
      select 1
      from event_stops es
      join events e on e.id = es.event_id
      where es.wing_spot_id = wing_spots.id
        and e.is_published = true
    )
  );
