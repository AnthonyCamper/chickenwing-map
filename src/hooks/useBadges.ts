import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { BadgeWithEarned } from '../lib/types'

export interface UseBadgesReturn {
  badges: BadgeWithEarned[]
  earned: BadgeWithEarned[]
  locked: BadgeWithEarned[]
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Reads the badges_for_user view, which joins the global badges list with
 * the current authenticated user's earned status. RLS on the view scopes
 * results to auth.uid().
 */
export function useBadges(userId: string | null | undefined): UseBadgesReturn {
  const [badges, setBadges] = useState<BadgeWithEarned[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setBadges([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('badges_for_user')
      .select('*')
      .order('sort_order', { ascending: true })
    setBadges((data ?? []) as BadgeWithEarned[])
    setLoading(false)
  }, [userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  return {
    badges,
    earned: badges.filter(b => b.earned),
    locked: badges.filter(b => !b.earned),
    loading,
    refresh: fetchAll,
  }
}
