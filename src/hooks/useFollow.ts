import { useCallback, useEffect, useState } from 'react'
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
        isSelf
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
    if (isFollowing) {
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
      await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetUserId })
    } else {
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetUserId })
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
