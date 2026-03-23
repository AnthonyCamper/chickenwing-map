import { supabase } from './supabase'

export interface ReactionUser {
  name: string
  avatar: string | null
  reactionType?: string
}

export async function fetchPhotoLikers(photoId: string): Promise<ReactionUser[]> {
  const { data: likes } = await supabase
    .from('photo_likes')
    .select('user_id')
    .eq('photo_id', photoId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!likes?.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, email')
    .in('id', likes.map(l => l.user_id))

  const profileMap = new Map(
    (profiles ?? []).map(p => [p.id, p])
  )

  return likes.map(l => {
    const p = profileMap.get(l.user_id)
    return {
      name: p?.display_name || p?.full_name || p?.email?.split('@')[0] || 'Unknown',
      avatar: p?.avatar_url ?? null,
    }
  })
}

export async function fetchCommentLikers(commentId: string): Promise<ReactionUser[]> {
  const { data: likes } = await supabase
    .from('comment_likes')
    .select('user_id')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!likes?.length) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, email')
    .in('id', likes.map(l => l.user_id))

  const profileMap = new Map(
    (profiles ?? []).map(p => [p.id, p])
  )

  return likes.map(l => {
    const p = profileMap.get(l.user_id)
    return {
      name: p?.display_name || p?.full_name || p?.email?.split('@')[0] || 'Unknown',
      avatar: p?.avatar_url ?? null,
    }
  })
}

export async function fetchCommentReactors(commentId: string): Promise<ReactionUser[]> {
  const { data: reactions } = await supabase
    .from('comment_reactions')
    .select('user_id, reaction_type')
    .eq('comment_id', commentId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!reactions?.length) return []

  const userIds = [...new Set(reactions.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, display_name, avatar_url, email')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map(p => [p.id, p])
  )

  return reactions.map(r => {
    const p = profileMap.get(r.user_id)
    return {
      name: p?.display_name || p?.full_name || p?.email?.split('@')[0] || 'Unknown',
      avatar: p?.avatar_url ?? null,
      reactionType: r.reaction_type,
    }
  })
}
