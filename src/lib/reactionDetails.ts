import { supabase } from './supabase'

export interface ReactionUser {
  name: string
  avatar: string | null
  reactionType?: string
}

// ── Review-level likes ──────────────────────────────────────────────────────

export async function fetchReviewLikers(reviewId: string): Promise<ReactionUser[]> {
  const { data: likes } = await supabase
    .from('review_likes')
    .select('user_id')
    .eq('review_id', reviewId)
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

// ── Review-level reactions ───────────────────────────────────────────────────

export async function fetchReviewReactors(reviewId: string): Promise<ReactionUser[]> {
  const { data: reactions } = await supabase
    .from('review_reactions')
    .select('user_id, reaction_type')
    .eq('review_id', reviewId)
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

// ── Review comment variants ─────────────────────────────────────────────────

export async function fetchReviewCommentLikers(commentId: string): Promise<ReactionUser[]> {
  const { data: likes } = await supabase
    .from('review_comment_likes')
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

export async function fetchReviewCommentReactors(commentId: string): Promise<ReactionUser[]> {
  const { data: reactions } = await supabase
    .from('review_comment_reactions')
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
