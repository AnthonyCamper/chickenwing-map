import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useUserProfile } from '../UserProfileContext'
import { useAuthGate } from '../AuthGateModal'
import AvatarImage from '../ui/AvatarImage'
import { cleanUserText } from '../../lib/userText'
import { noteFollowChange } from '../../hooks/useFollow'

interface UserRow {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  review_count: number
  badge_count: number
  unique_spots: number
}

interface Props {
  currentUserId: string
}

export default function PeopleView({ currentUserId }: Props) {
  const { openProfile } = useUserProfile()
  const { requireAuth } = useAuthGate()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const [usersRes, followsRes] = await Promise.all([
        supabase
          .from('leaderboard_stats')
          .select('user_id, display_name, avatar_url, review_count, badge_count, unique_spots')
          .order('review_count', { ascending: false }),
        // Signed out there is nobody to follow from; querying with an empty
        // id was a guaranteed 400 on every visit to this tab.
        currentUserId
          ? supabase
              .from('follows')
              .select('following_id')
              .eq('follower_id', currentUserId)
          : Promise.resolve({ data: [] as { following_id: string }[] }),
      ])
      if (cancelled) return
      if (usersRes.error) {
        setError("Couldn't load people. Check your connection and try again.")
        setUsers([])
        setLoading(false)
        return
      }
      setUsers((usersRes.data ?? []) as UserRow[])
      setFollowingIds(new Set((followsRes.data ?? []).map((r: any) => r.following_id)))
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [currentUserId, reloadKey])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? users.filter(u => (u.display_name ?? '').toLowerCase().includes(q))
      : users
    // Sort: not-yet-following (excluding self) first, then following, then self
    return [...list].sort((a, b) => {
      const aMe = a.user_id === currentUserId
      const bMe = b.user_id === currentUserId
      if (aMe !== bMe) return aMe ? 1 : -1
      const aFollowing = followingIds.has(a.user_id)
      const bFollowing = followingIds.has(b.user_id)
      if (aFollowing !== bFollowing) return aFollowing ? 1 : -1
      return b.review_count - a.review_count
    })
  }, [users, search, followingIds, currentUserId])

  async function toggle(e: React.MouseEvent, targetId: string) {
    e.stopPropagation()
    if (!currentUserId) { requireAuth(); return }
    const isFollowing = followingIds.has(targetId)
    setFollowingIds(prev => {
      const next = new Set(prev)
      if (isFollowing) next.delete(targetId)
      else next.add(targetId)
      return next
    })
    const { error } = isFollowing
      ? await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetId })
      : await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
    if (!error) noteFollowChange(currentUserId, !isFollowing)
  }

  if (loading) {
    return (
      // Fill the screen so the footer doesn't jump when the list arrives
      <div className="flex justify-center pt-20 min-h-[100dvh]" role="status" aria-label="Loading people">
        <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <div className="text-5xl mb-4">🧯</div>
        <h3 className="font-display text-lg text-charcoal-700 mb-2">Couldn't load people</h3>
        <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">{error}</p>
        <button onClick={() => setReloadKey(k => k + 1)} className="btn-secondary px-5">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-safe-fab">
      <div className="relative mb-4">
        <input
          type="search"
          className="input pl-9"
          placeholder="Search people…"
          aria-label="Search people by name"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400 pointer-events-none"
             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm text-charcoal-500">No one found for "{search}"</p>
        </div>
      ) : (
        <ul className="divide-y divide-night-900/8">
          {filtered.map(u => {
            const isMe = u.user_id === currentUserId
            const isFollowing = followingIds.has(u.user_id)
            const name = cleanUserText(u.display_name) || 'Unknown'
            return (
              <li
                key={u.user_id}
                onClick={() => openProfile(u.user_id)}
                className="flex items-center gap-3 py-3 cursor-pointer hover:bg-cream-100/60 -mx-1 px-1 rounded-lg transition-colors"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-night-900 flex-shrink-0 bg-night-700 flex items-center justify-center shadow-sticker-sm">
                  <AvatarImage
                    src={u.avatar_url}
                    alt={name}
                    className="w-full h-full object-cover"
                    fallback={<span className="text-base font-extrabold text-cream-50 uppercase">{name.charAt(0)}</span>}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold uppercase tracking-crowd text-night-900 truncate leading-tight">
                    <span className="user-text">{name}</span>
                    {isMe && <span className="ml-1.5 text-sauce-400 text-[10px]">YOU</span>}
                  </p>
                  <p className="text-[11px] text-charcoal-500 font-medium mt-0.5">
                    {u.review_count} {u.review_count === 1 ? 'review' : 'reviews'}
                    {u.unique_spots > 0 && ` · ${u.unique_spots} ${u.unique_spots === 1 ? 'spot' : 'spots'}`}
                    {u.badge_count > 0 && ` · ${u.badge_count} ${u.badge_count === 1 ? 'badge' : 'badges'}`}
                  </p>
                </div>

                {!isMe && (
                  <button
                    onClick={e => toggle(e, u.user_id)}
                    className={`group flex-shrink-0 min-h-11 font-extrabold uppercase tracking-crowd text-[11px] px-4 py-1.5 rounded-lg border-2 transition-all ${
                      isFollowing
                        ? 'bg-transparent border-night-900/20 text-charcoal-500 hover:border-sauce-400 hover:text-sauce-400'
                        : 'bg-sauce-400 border-sauce-400 text-cream-50 hover:bg-sauce-500 hover:border-sauce-500'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <span className="group-hover:hidden">Following</span>
                        <span className="hidden group-hover:inline">Unfollow</span>
                      </>
                    ) : 'Follow'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
