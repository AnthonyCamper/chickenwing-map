import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'

export interface PublicProfile {
  id: string
  display_name: string | null
  avatar_url: string | null
}

interface UseFollowReturn {
  isFollowing: boolean
  followerCount: number
  followingCount: number
  loading: boolean
  toggle: () => Promise<void>
}

// ── "Does this user follow anyone?" ─────────────────────────────────────────
// Decides the default feed tab: someone who follows nobody would land on an
// empty Following tab, so they get Discover instead. Cached per user for the
// SPA session; follow/unfollow actions keep it current.
const followsAnyoneCache = new Map<string, boolean>()

/** Record a follow/unfollow so the next feed visit picks the right tab. */
export function noteFollowChange(userId: string, nowFollowing: boolean) {
  if (!userId) return
  if (nowFollowing) followsAnyoneCache.set(userId, true)
  else followsAnyoneCache.delete(userId) // may still follow others: re-check
}

/** Test helper */
export function _resetFollowsAnyoneCache() {
  followsAnyoneCache.clear()
}

/**
 * true / false once known, null while loading. Signed out → false.
 * On a failed query it answers true (the old default: Following).
 */
export function useFollowsAnyone(userId: string): boolean | null {
  const [value, setValue] = useState<boolean | null>(() =>
    !userId ? false : followsAnyoneCache.get(userId) ?? null
  )

  useEffect(() => {
    if (!userId) { setValue(false); return }
    const cached = followsAnyoneCache.get(userId)
    if (cached !== undefined) { setValue(cached); return }
    setValue(null)
    let cancelled = false
    // A 1-row GET, not a HEAD count: count requests get aborted on navigation
    supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId)
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        const follows = error ? true : (data ?? []).length > 0
        if (!error) followsAnyoneCache.set(userId, follows)
        setValue(follows)
      })
    return () => { cancelled = true }
  }, [userId])

  return value
}

export function useFollow(currentUserId: string, targetUserId: string): UseFollowReturn {
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const isSelf = !!currentUserId && currentUserId === targetUserId

  useEffect(() => {
    if (!targetUserId) { setLoading(false); return }

    async function load() {
      setLoading(true)
      const [followCheck, followerRes, followingRes] = await Promise.all([
        // Signed out (no currentUserId) there's no follow to check; an empty
        // follower_id makes PostgREST answer 400.
        isSelf || !currentUserId
          ? Promise.resolve({ data: null })
          : supabase.from('follows').select('id').match({ follower_id: currentUserId, following_id: targetUserId }).maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', targetUserId),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', targetUserId),
      ])
      setIsFollowing(!!(followCheck as any).data)
      setFollowerCount(followerRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [currentUserId, targetUserId, isSelf])

  const toggle = useCallback(async () => {
    if (!currentUserId || !targetUserId || isSelf) return
    const wasFollowing = isFollowing

    setIsFollowing(!wasFollowing)
    setFollowerCount(c => c + (wasFollowing ? -1 : 1))

    const { error } = wasFollowing
      ? await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetUserId })
      : await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId })

    if (error) {
      setIsFollowing(wasFollowing)
      setFollowerCount(c => c + (wasFollowing ? 1 : -1))
      toast.error(wasFollowing ? 'Could not unfollow' : 'Could not follow')
    } else {
      noteFollowChange(currentUserId, !wasFollowing)
    }
  }, [currentUserId, targetUserId, isFollowing, isSelf])

  return { isFollowing, followerCount, followingCount, loading, toggle }
}

export async function fetchFollowers(userId: string): Promise<PublicProfile[]> {
  const { data } = await supabase
    .from('follows')
    .select('follower:profiles!follower_id(id, display_name, avatar_url)')
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as any[]).map(r => r.follower).filter(Boolean)
}

export async function fetchFollowing(userId: string): Promise<PublicProfile[]> {
  const { data } = await supabase
    .from('follows')
    .select('following:profiles!following_id(id, display_name, avatar_url)')
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
  return ((data ?? []) as any[]).map(r => r.following).filter(Boolean)
}

export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', userId)
  return (data ?? []).map((r: any) => r.following_id)
}
