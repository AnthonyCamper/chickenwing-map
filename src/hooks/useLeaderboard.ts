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
      const sorted = sortBy(data as LeaderboardRow[], category)
      setRows(sorted)
    }
    setLoading(false)
  }, [category])

  useEffect(() => { fetch() }, [fetch])

  const myRank = currentUserId
    ? rows.findIndex(r => r.user_id === currentUserId) + 1 || null
    : null

  return { rows, loading, category, setCategory, myRank }
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
