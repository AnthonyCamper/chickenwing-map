import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useFollow, fetchFollowers, fetchFollowing } from '../hooks/useFollow'
import BadgeGrid from './badges/BadgeGrid'
import type { BadgeWithEarned } from '../lib/types'
import type { PublicProfile } from '../hooks/useFollow'

interface ProfileData {
  id: string
  display_name: string | null
  full_name: string | null
  avatar_url: string | null
  created_at: string
}

interface StatsData {
  review_count: number
  unique_spots: number
  avg_rating: number | null
  comment_count: number
  badge_count: number
  total_likes_received: number
}

interface ReviewItem {
  id: string
  overall_rating: number
  wing_flavor: string | null
  wing_size: string | null
  review_text: string | null
  visited_at: string
  spot_name: string
}

type Tab = 'stats' | 'badges' | 'reviews'
type ListMode = 'followers' | 'following' | null

interface Props {
  userId: string
  currentUserId: string
  onClose: () => void
}

export default function UserProfileModal({ userId, currentUserId, onClose }: Props) {
  const isSelf = userId === currentUserId

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [badges, setBadges] = useState<BadgeWithEarned[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [tab, setTab] = useState<Tab>('stats')

  const [listMode, setListMode] = useState<ListMode>(null)
  const [listUsers, setListUsers] = useState<PublicProfile[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())

  const follow = useFollow(currentUserId, userId)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [profileRes, statsRes, badgesRes, reviewsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, created_at')
          .eq('id', userId)
          .single(),
        supabase
          .from('leaderboard_stats')
          .select('review_count, unique_spots, avg_rating, comment_count, badge_count, total_likes_received')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('user_badges')
          .select('earned_at, badges(id, slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order)')
          .eq('user_id', userId)
          .order('earned_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('id, overall_rating, wing_flavor, wing_size, review_text, visited_at, wing_spots(name)')
          .eq('user_id', userId)
          .order('visited_at', { ascending: false })
          .limit(12),
      ])
      setProfile(profileRes.data as ProfileData | null)
      setStats(statsRes.data as StatsData | null)
      setBadges(
        ((badgesRes.data ?? []) as any[])
          .filter(r => r.badges)
          .map(r => ({ ...r.badges, earned: true, earned_at: r.earned_at })) as BadgeWithEarned[]
      )
      setReviews(
        ((reviewsRes.data ?? []) as any[]).map(r => ({
          id: r.id,
          overall_rating: r.overall_rating,
          wing_flavor: r.wing_flavor,
          wing_size: r.wing_size,
          review_text: r.review_text,
          visited_at: r.visited_at,
          spot_name: r.wing_spots?.name ?? 'Unknown spot',
        }))
      )
      setLoading(false)
    }
    load()
  }, [userId])

  async function openList(mode: ListMode) {
    if (!mode) return
    setListMode(mode)
    setListLoading(true)
    const [users, followingRes] = await Promise.all([
      mode === 'followers' ? fetchFollowers(userId) : fetchFollowing(userId),
      supabase.from('follows').select('following_id').eq('follower_id', currentUserId),
    ])
    setListUsers(users)
    setMyFollowingIds(new Set((followingRes.data ?? []).map((r: any) => r.following_id)))
    setListLoading(false)
  }

  async function toggleListFollow(targetId: string) {
    const isNowFollowing = myFollowingIds.has(targetId)
    setMyFollowingIds(prev => {
      const next = new Set(prev)
      if (isNowFollowing) next.delete(targetId)
      else next.add(targetId)
      return next
    })
    if (isNowFollowing) {
      await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetId })
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
    }
  }

  const name = profile?.display_name ?? profile?.full_name ?? 'Unknown'
  const initials = name.charAt(0).toUpperCase()

  const TABS: { key: Tab; label: string }[] = [
    { key: 'stats',   label: 'Stats' },
    { key: 'badges',  label: `Badges${badges.length ? ` · ${badges.length}` : ''}` },
    { key: 'reviews', label: `Reviews${stats?.review_count ? ` · ${stats.review_count}` : ''}` },
  ]

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-night-900/70 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[60] sm:inset-0 sm:flex sm:items-center sm:justify-center p-0 sm:p-6">
        <div className="relative w-full sm:max-w-sm bg-cream-50 sm:rounded-2xl sm:border-2 sm:border-night-900 sm:shadow-sticker overflow-hidden flex flex-col animate-slide-up"
             style={{ maxHeight: '92dvh' }}>

          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-night-900/20" />
          </div>

          {/* Dark header */}
          <div className="bg-night-900 px-5 pt-4 pb-4 flex-shrink-0 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-10" aria-hidden="true"
                 style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '12px 12px' }} />

            <div className="relative flex items-start gap-3">
              {/* Avatar */}
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-cream-50/30 shadow-sticker-sm flex-shrink-0 bg-night-700 flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-extrabold text-cream-50">{initials}</span>
                )}
              </div>

              {/* Name + counts */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-display uppercase tracking-wide text-xl text-cream-50 leading-tight truncate">
                  {loading ? '…' : name}
                  {isSelf && <span className="ml-2 text-[10px] font-extrabold text-sauce-300 tracking-crowd">YOU</span>}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    onClick={() => openList('followers')}
                    className="text-[11px] font-bold text-cream-100/70 hover:text-cream-50 transition-colors"
                  >
                    <span className="text-cream-50 font-extrabold">{follow.followerCount}</span> followers
                  </button>
                  <button
                    onClick={() => openList('following')}
                    className="text-[11px] font-bold text-cream-100/70 hover:text-cream-50 transition-colors"
                  >
                    <span className="text-cream-50 font-extrabold">{follow.followingCount}</span> following
                  </button>
                </div>
              </div>

              {/* Right side — close + follow */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg bg-night-700 text-cream-50 flex items-center justify-center text-lg hover:bg-sauce-500 transition-colors border border-night-500"
                  aria-label="Close"
                >×</button>
                {!isSelf && (
                  <FollowButton
                    isFollowing={follow.isFollowing}
                    loading={follow.loading}
                    onToggle={follow.toggle}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b-2 border-night-900/10 flex-shrink-0 px-5 bg-cream-50">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`mr-4 py-2.5 text-[11px] font-extrabold uppercase tracking-crowd transition-colors border-b-2 -mb-[2px]
                  ${tab === t.key ? 'border-sauce-400 text-sauce-500' : 'border-transparent text-charcoal-400 hover:text-night-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
              </div>
            ) : (
              <>
                {tab === 'stats' && <StatsTab stats={stats} />}
                {tab === 'badges' && <BadgesTab badges={badges} />}
                {tab === 'reviews' && <ReviewsTab reviews={reviews} />}
              </>
            )}
          </div>

          {/* Follower/following list overlay */}
          {listMode && (
            <div className="absolute inset-0 bg-cream-50 flex flex-col z-10">
              <div className="flex items-center gap-3 px-5 py-3.5 border-b-2 border-night-900/10 flex-shrink-0">
                <button
                  onClick={() => setListMode(null)}
                  className="w-8 h-8 rounded-lg bg-cream-100 border border-night-900/20 flex items-center justify-center text-night-700 hover:bg-cream-200 transition-colors"
                  aria-label="Back"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <p className="font-display uppercase tracking-wide text-base text-night-900">
                  {listMode === 'followers' ? `${follow.followerCount} Followers` : `${follow.followingCount} Following`}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {listLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-7 h-7 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
                  </div>
                ) : listUsers.length === 0 ? (
                  <div className="py-16 text-center">
                    <p className="text-4xl mb-3">👤</p>
                    <p className="text-sm text-charcoal-500">Nobody here yet</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-night-900/5">
                    {listUsers.map(u => (
                      <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-night-900 flex-shrink-0 bg-night-700 flex items-center justify-center shadow-sticker-sm">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-extrabold text-cream-50 uppercase">
                              {(u.display_name ?? '?').charAt(0)}
                            </span>
                          )}
                        </div>
                        <p className="flex-1 min-w-0 text-sm font-extrabold uppercase tracking-crowd text-night-900 truncate">
                          {u.display_name ?? 'Unknown'}
                          {u.id === currentUserId && <span className="ml-1.5 text-sauce-400 text-[10px]">YOU</span>}
                        </p>
                        {u.id !== currentUserId && (
                          <FollowButton
                            isFollowing={myFollowingIds.has(u.id)}
                            loading={false}
                            onToggle={() => toggleListFollow(u.id)}
                            compact
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FollowButton({ isFollowing, loading, onToggle, compact = false }: {
  isFollowing: boolean
  loading: boolean
  onToggle: () => void
  compact?: boolean
}) {
  if (loading) return null
  return (
    <button
      onClick={onToggle}
      className={`group font-extrabold uppercase tracking-crowd transition-all border-2 ${
        compact ? 'text-[10px] px-3 py-1 rounded-lg' : 'text-[11px] px-4 py-1.5 rounded-lg'
      } ${
        isFollowing
          ? 'bg-transparent border-cream-50/40 text-cream-200 hover:border-sauce-400 hover:text-sauce-300'
          : 'bg-sauce-400 border-sauce-400 text-cream-50 hover:bg-sauce-500 hover:border-sauce-500'
      }`}
    >
      {isFollowing ? (
        <span>
          <span className="group-hover:hidden">Following</span>
          <span className="hidden group-hover:inline">Unfollow</span>
        </span>
      ) : 'Follow'}
    </button>
  )
}

function StatsTab({ stats }: { stats: StatsData | null }) {
  if (!stats) {
    return (
      <div className="py-12 text-center">
        <p className="text-4xl mb-3">🍗</p>
        <p className="text-sm text-charcoal-500">No activity yet</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <StatCard emoji="🍗" label="Reviews"       value={stats.review_count} />
      <StatCard emoji="📍" label="Unique spots"   value={stats.unique_spots} />
      <StatCard emoji="⭐" label="Avg rating"     value={stats.avg_rating != null ? stats.avg_rating.toFixed(1) : '—'} />
      <StatCard emoji="💬" label="Comments"       value={stats.comment_count} />
      <StatCard emoji="🏅" label="Badges"         value={stats.badge_count} />
      <StatCard emoji="❤️" label="Likes received" value={stats.total_likes_received} />
    </div>
  )
}

function BadgesTab({ badges }: { badges: BadgeWithEarned[] }) {
  if (badges.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-4xl mb-3">🔒</p>
        <p className="font-display uppercase tracking-wide text-lg text-night-900">No badges yet</p>
        <p className="text-sm text-charcoal-500 mt-1">Post reviews to start earning badges.</p>
      </div>
    )
  }
  return <BadgeGrid badges={badges} />
}

function ReviewsTab({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-4xl mb-3">📝</p>
        <p className="text-sm text-charcoal-500">No reviews yet</p>
      </div>
    )
  }
  return (
    <ul className="space-y-2.5">
      {reviews.map(r => {
        const date = (() => {
          try { return format(new Date(r.visited_at), 'MMM d, yyyy') }
          catch { return r.visited_at }
        })()
        return (
          <li key={r.id} className="rounded-xl border border-night-900/10 bg-cream-100/50 px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold uppercase tracking-crowd text-night-900 leading-tight truncate flex-1">
                {r.spot_name}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-amber-400 text-xs">🍗</span>
                <span className="text-xs font-extrabold text-night-900">{r.overall_rating}/10</span>
              </div>
            </div>
            {(r.wing_flavor || r.wing_size) && (
              <p className="text-[11px] text-charcoal-500 font-medium mt-0.5">
                {[r.wing_flavor, r.wing_size && `${r.wing_size} wings`].filter(Boolean).join(' · ')}
              </p>
            )}
            {r.review_text && (
              <p className="text-xs text-charcoal-600 mt-1.5 leading-relaxed line-clamp-2">{r.review_text}</p>
            )}
            <p className="text-[10px] text-charcoal-300 font-bold uppercase tracking-crowd mt-2">{date}</p>
          </li>
        )
      })}
    </ul>
  )
}

function StatCard({ emoji, label, value }: { emoji: string; label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-4 rounded-xl bg-night-800 border-2 border-night-900 shadow-sticker-sm text-center">
      <span className="text-2xl leading-none">{emoji}</span>
      <span className="font-display uppercase tracking-wide text-2xl text-cream-50 leading-none mt-1">{value}</span>
      <span className="text-[9px] font-extrabold uppercase tracking-crowd text-cream-100/60">{label}</span>
    </div>
  )
}
