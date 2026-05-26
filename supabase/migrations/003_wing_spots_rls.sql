-- Fix RLS policies for wing_spots.
-- The table had SELECT and INSERT policies but no UPDATE policy, so the upsert
-- onConflict path (which becomes an UPDATE) was blocked.

-- UPDATE: only approved reviewers can update existing spots (upsert conflict path)
CREATE POLICY "Wing spots: approved reviewers can update"
  ON public.wing_spots FOR UPDATE
  USING (can_review())
  WITH CHECK (can_review());
