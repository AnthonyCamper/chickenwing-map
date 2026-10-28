import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { groupSpots } from './useReviews'
import type { Review, SpotWithReviews, WingSpot } from '../lib/types'

// Just the columns the "Wing news" ticker reads (LiveScene buildDataItems /
// countRatedSpots): ~48 KB instead of the ~350 KB the Spots and Map views
// load. Lets the feed fill the ticker without downloading that (S26).
const SPOT_COLUMNS = 'id, name'
const REVIEW_COLUMNS = 'id, wing_spot_id, overall_rating, visited_at, reviewer_name, wing_flavor'

/**
 * Spots with their reviews, in the same shape as useReviews().spots but with
 * only the fields the ticker uses filled in. Fetched once `enabled` is true.
 */
export function useTickerSpots(enabled: boolean): { spots: SpotWithReviews[]; loading: boolean } {
  const [state, setState] = useState<{ spots: SpotWithReviews[]; loading: boolean }>({ spots: [], loading: true })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    Promise.all([
      supabase.from('wing_spots').select(SPOT_COLUMNS),
      supabase.from('reviews_with_profiles').select(REVIEW_COLUMNS).order('visited_at', { ascending: false }),
    ]).then(([spotRes, reviewRes]) => {
      if (cancelled) return
      // The ticker is decoration: on an error it just runs without the
      // "from your data" lines.
      const spots = spotRes.error || reviewRes.error
        ? []
        : groupSpots(
            (spotRes.data ?? []) as unknown as WingSpot[],
            (reviewRes.data ?? []) as unknown as Review[],
          )
      setState({ spots, loading: false })
    }, () => {
      if (!cancelled) setState({ spots: [], loading: false })
    })
    return () => { cancelled = true }
  }, [enabled])

  return state
}
