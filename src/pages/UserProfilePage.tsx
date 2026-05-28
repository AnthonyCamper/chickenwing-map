import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import BadgeGrid from '../components/badges/BadgeGrid'
import TopBar from '../components/ui/TopBar'
import { useAuthGate } from '../components/AuthGateModal'
import type { UserProfile, Review, WingSpot, BadgeWithEarned, WingCrawlDetailed } from '../lib/types'

interface Stats {
  reviewCount: number
  uniqueSpots: number
  avgRating: number | null
  badgeCount: number
  totalLikesReceived: number
}

interface ProfileDetail {
  profile: UserProfile
  reviews: Review[]
  spotsById: Record<string, WingSpot>
  badges: BadgeWithEarned[]
  crawls: WingCrawlDetailed[]
  stats: Stats
  followerCount: number
  followingCount: number
  isOwner: boolean
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>()
  const [data, setData] = useState<ProfileDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'private' | 'error'>('loading')
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followBusy, setFollowBusy] = useState(false)
  const { requireAuth } = useAuthGate()

  useEffect(() => {
    if (!username) return
    let cancelled = false

    async function load() {
      setStatus('loading')

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle()

      if (cancelled) return
      if (profileErr) { setStatus('error'); return }
      if (!profile) { setStatus('not-found'); return }

      const { data: { session } } = await supabase.auth.getSession()
      const viewerId = session?.user?.id ?? ''
      const isOwner = viewerId === profile.id

      if (cancelled) return
      setCurrentUserId(viewerId)

      if (profile.is_private && !isOwner) {
        setData({
          profile: profile as UserProfile,
          reviews: [], spotsById: {}, badges: [], crawls: [],
          stats: { reviewCount: 0, uniqueSpots: 0, avgRating: null, badgeCount: 0, totalLikesReceived: 0 },
          followerCount: 0, followingCount: 0, isOwner: false,
        })
        setStatus('private')
        return
      }

      const [reviewsRes, badgesRes, statsRes, followerRes, followingRes, followCheckRes, crawlsRes] = await Promise.all([
        supabase
          .from('reviews_with_profiles')
          .select('*')
          .eq('user_id', profile.id)
          .order('visited_at', { ascending: false })
          .limit(50),
        supabase
          .from('user_badges')
          .select('earned_at, badges(id, slug, name, description, icon, color, criteria_type, criteria_config, event_id, sort_order)')
          .eq('user_id', profile.id)
          .order('earned_at', { ascending: false }),
        supabase
          .from('leaderboard_stats')
          .select('review_count, unique_spots, avg_rating, comment_count, badge_count, total_likes_received')
          .eq('user_id', profile.id)
          .maybeSingle(),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id),
        viewerId && !isOwner
          ? supabase.from('follows').select('id').match({ follower_id: viewerId, following_id: profile.id }).maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('wing_crawls_detailed')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false }),
      ])

      if (cancelled) return

      const reviewList = (reviewsRes.data ?? []) as Review[]
      const spotIds = Array.from(new Set(reviewList.map(r => r.wing_spot_id)))
      const { data: spots } = spotIds.length
        ? await supabase.from('wing_spots').select('*').in('id', spotIds)
        : { data: [] }

      const spotsById: Record<string, WingSpot> = {}
      for (const s of (spots ?? []) as WingSpot[]) spotsById[s.id] = s

      const badges = ((badgesRes.data ?? []) as any[])
        .filter(r => r.badges)
        .map(r => ({ ...r.badges, earned: true, earned_at: r.earned_at })) as BadgeWithEarned[]

      const ratings = reviewList.map(r => Number(r.overall_rating)).filter(n => !Number.isNaN(n))
      const stats: Stats = {
        reviewCount: statsRes.data?.review_count ?? reviewList.length,
        uniqueSpots: statsRes.data?.unique_spots ?? spotIds.length,
        avgRating: statsRes.data?.avg_rating ?? (ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null),
        badgeCount: statsRes.data?.badge_count ?? badges.length,
        totalLikesReceived: statsRes.data?.total_likes_received ?? 0,
      }

      if (cancelled) return
      setIsFollowing(!!(followCheckRes as any).data)
      setData({
        profile: profile as UserProfile,
        reviews: reviewList,
        spotsById,
        badges,
        crawls: (crawlsRes.data ?? []) as WingCrawlDetailed[],
        stats,
        followerCount: followerRes.count ?? 0,
        followingCount: followingRes.count ?? 0,
        isOwner,
      })
      setStatus('ready')
    }

    load()
    return () => { cancelled = true }
  }, [username])

  async function handleFollowToggle() {
    if (!data) return
    if (!requireAuth()) return
    if (data.isOwner) return
    if (followBusy) return

    setFollowBusy(true)
    const targetId = data.profile.id
    const next = !isFollowing
    setIsFollowing(next)
    setData(d => d ? { ...d, followerCount: d.followerCount + (next ? 1 : -1) } : d)

    try {
      if (next) {
        const { error } = await supabase.from('follows').insert({ follower_id: currentUserId, following_id: targetId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: targetId })
        if (error) throw error
      }
    } catch {
      // revert
      setIsFollowing(!next)
      setData(d => d ? { ...d, followerCount: d.followerCount + (next ? -1 : 1) } : d)
      toast.error('Could not update follow')
    } finally {
      setFollowBusy(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">No user here</h1>
        <Link to="/" className="btn-secondary">Back to the map</Link>
      </div>
    )
  }

  if (status === 'private' && data) {
    return (
      <div className="min-h-dvh bg-paper">
        <Helmet>
          <title>Private profile — WingKingTony</title>
          <meta name="description" content="This wing-logger has set their profile to private." />
        </Helmet>
        <div className="max-w-2xl mx-auto px-5 py-20 text-center">
          <p className="eyebrow mb-3">Members only</p>
          <h1 className="font-display uppercase text-3xl text-night-900 mb-3">Private profile</h1>
          <p className="text-sm text-charcoal-600 mb-8">This wing-logger keeps their stuff to themselves.</p>
          <Link to="/" className="btn-secondary">Back to the map</Link>
        </div>
      </div>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="font-display uppercase text-3xl text-night-900">Something broke</h1>
        <Link to="/" className="btn-secondary">Back to the map</Link>
      </div>
    )
  }

  const { profile, reviews, spotsById, badges, crawls, stats, followerCount, followingCount, isOwner } = data
  const displayName = profile.display_name ?? profile.full_name ?? profile.username ?? 'Unknown'
  const description = stats.reviewCount > 0
    ? `${displayName} on WingKingTony — ${stats.reviewCount} wing ${stats.reviewCount === 1 ? 'review' : 'reviews'}${stats.avgRating != null ? ` · avg ${stats.avgRating.toFixed(1)}/10` : ''}.`
    : `${displayName} on WingKingTony.`

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{displayName} — WingKingTony</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${displayName} — WingKingTony`} />
        <meta property="og:description" content={description} />
        {profile.avatar_url && <meta property="og:image" content={profile.avatar_url} />}
        <meta property="og:type" content="profile" />
        <link rel="canonical" href={`https://wingkingtony.com/u/${profile.username}`} />
      </Helmet>

      <TopBar />

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-3xl mx-auto px-5 py-6">
          <div className="flex items-start gap-4">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full border-2 border-night-900 object-cover shadow-sticker" />
            ) : (
              <div className="w-20 h-20 rounded-full border-2 border-night-900 bg-cream-200 flex items-center justify-center text-2xl font-bold text-night-900 shadow-sticker">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="font-display uppercase text-3xl text-night-900 leading-none tracking-tightest truncate">{displayName}</h1>
              <p className="text-xs text-charcoal-500 mt-1">@{profile.username}</p>
            </div>
            {!isOwner && (
              <button
                onClick={handleFollowToggle}
                disabled={followBusy}
                className={isFollowing ? 'btn-secondary px-4 py-1.5 text-xs' : 'btn-primary px-4 py-1.5 text-xs'}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {profile.bio && (
            <p className="text-sm text-charcoal-700 mt-4 max-w-prose whitespace-pre-wrap">{profile.bio}</p>
          )}

          <div className="flex gap-6 mt-5 text-sm flex-wrap">
            <Stat label="Reviews" value={stats.reviewCount} />
            <Stat label="Spots" value={stats.uniqueSpots} />
            <Stat label="Avg" value={stats.avgRating != null ? stats.avgRating.toFixed(1) : '—'} />
            <Stat label="Badges" value={stats.badgeCount} />
            <Stat label="Followers" value={followerCount} />
            <Stat label="Following" value={followingCount} />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-safe-8 space-y-8">
        {badges.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Badges</h2>
            <BadgeGrid badges={badges} emptyMessage="No badges yet." />
          </section>
        )}

        {(crawls.length > 0 || isOwner) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="eyebrow">Crawls</h2>
              {isOwner && (
                <Link to="/crawls/new" className="text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600">
                  + New crawl
                </Link>
              )}
            </div>
            {crawls.length === 0 ? (
              <p className="text-charcoal-500 text-sm italic">No crawls yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {crawls.map(c => (
                  <Link
                    key={c.id}
                    to={`/lists/${c.slug}`}
                    className="block bg-cream-50 border-2 border-night-900 rounded-xl p-4 shadow-sticker hover:shadow-stickerHover transition-shadow"
                  >
                    <p className="font-display uppercase text-lg text-night-900 leading-tight tracking-tightest">{c.title}</p>
                    <p className="text-xs text-charcoal-500 mt-1">
                      {c.item_count} {c.item_count === 1 ? 'spot' : 'spots'}
                      {c.is_ranked && ' · Ranked'}
                      {!c.is_public && ' · Private'}
                    </p>
                    {c.description && (
                      <p className="text-sm text-charcoal-700 mt-2 line-clamp-2">{c.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        <section>
          <h2 className="eyebrow mb-3">Recent reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-charcoal-500 text-sm italic">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map(r => {
                const spot = spotsById[r.wing_spot_id]
                return (
                  <Link
                    key={r.id}
                    to={`/reviews/${r.id}`}
                    className="block bg-cream-50 border-2 border-night-900 rounded-xl p-4 shadow-sticker hover:shadow-stickerHover transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display uppercase text-lg text-night-900 truncate">{spot?.name ?? 'Unknown spot'}</p>
                        <p className="text-xs text-charcoal-500">
                          {(() => { try { return format(new Date(r.visited_at), 'MMM d, yyyy') } catch { return r.visited_at } })()}
                          {r.wing_flavor ? ` · ${r.wing_flavor}` : ''}
                        </p>
                      </div>
                      <div className="font-display text-2xl text-night-900 shrink-0">{Number(r.overall_rating).toFixed(1)}</div>
                    </div>
                    {r.review_text && (
                      <p className="text-sm text-charcoal-700 mt-2 line-clamp-3 whitespace-pre-wrap">{r.review_text}</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="font-display text-2xl text-night-900 leading-none">{value}</p>
      <p className="text-xs uppercase tracking-crowd text-charcoal-500">{label}</p>
    </div>
  )
}
