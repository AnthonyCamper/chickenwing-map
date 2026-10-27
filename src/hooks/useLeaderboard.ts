import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow } from '../lib/types'

export type LeaderboardCategory = 'reviews' | 'spots' | 'heat' | 'comments' | 'badges' | 'likes'

export interface UseLeaderboardReturn {
  rows: LeaderboardRow[]
  loading: boolean
  category: LeaderboardCategory
  setCategory: (c: LeaderboardCategory) => void
  myRank: number | null
}

export function useLeaderboard(currentUserId: string | undefined): UseLeaderboardReturn {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<LeaderboardCategory>('reviews')

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('leaderboard_stats').select('*')
    if (data) {
      setRows(rankRows(data as LeaderboardRow[], category))
    }
    setLoading(false)
  }, [category])

  useEffect(() => { fetch() }, [fetch])

  const myRank = currentUserId
    ? rows.findIndex(r => r.user_id === currentUserId) + 1 || null
    : null

  return { rows, loading, category, setCategory, myRank }
}

/**
 * An average from one or two reviews isn't a ranking: a brand-new account's
 * single 10/10 would top the board. The average-rating board only lists
 * people with at least this many reviews.
 */
export const MIN_REVIEWS_FOR_AVG_RANK = 3

export function rankRows(rows: LeaderboardRow[], cat: LeaderboardCategory): LeaderboardRow[] {
  const eligible = cat === 'heat'
    ? rows.filter(r => r.avg_rating != null && r.review_count >= MIN_REVIEWS_FOR_AVG_RANK)
    : rows
  return sortBy(eligible, cat)
}

function sortBy(rows: LeaderboardRow[], cat: LeaderboardCategory): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    switch (cat) {
      case 'reviews':  return b.review_count - a.review_count
      case 'spots':    return b.unique_spots - a.unique_spots
      case 'heat':     return (b.avg_rating ?? 0) - (a.avg_rating ?? 0)
      case 'comments': return b.comment_count - a.comment_count
      case 'badges':   return b.badge_count - a.badge_count
      case 'likes':    return b.total_likes_received - a.total_likes_received
    }
  })
}
