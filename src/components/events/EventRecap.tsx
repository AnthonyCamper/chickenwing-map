import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import BadgeIcon from '../badges/BadgeIcon'

interface RecapReview {
  id: string
  user_id: string
  overall_rating: number
  spot_name?: string | null
  user_name?: string | null
}

interface RecapPhoto {
  id: string
  review_id: string
  photo_url: string
}

interface BadgeWinner {
  badge_id: string
  name: string
  icon: string
  color: string
  earners: Array<{ user_id: string; display_name: string; avatar_url: string | null }>
}

interface Props {
  eventId: string
  totalStops: number
  totalCheckins: number
}

/**
 * Post-crawl recap: the night's photos, who earned what, and the numbers.
 * Fetches its own data — only mounted in the wrapped phase for signed-in
 * viewers, so the cost never hits the hot paths.
 */
export default function EventRecap({ eventId, totalStops, totalCheckins }: Props) {
  const [reviews, setReviews] = useState<RecapReview[]>([])
  const [photos, setPhotos] = useState<RecapPhoto[]>([])
  const [winners, setWinners] = useState<BadgeWinner[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: revs } = await supabase
        .from('reviews_with_profiles')
        .select('id, user_id, overall_rating, spot_name, user_name')
        .eq('event_id', eventId)
      if (cancelled) return
      const reviewRows = (revs ?? []) as RecapReview[]
      setReviews(reviewRows)

      if (reviewRows.length > 0) {
        const { data: pics } = await supabase
          .from('review_photos')
          .select('id, review_id, photo_url')
          .in('review_id', reviewRows.map(r => r.id))
          .order('display_order')
        if (!cancelled) setPhotos((pics ?? []) as RecapPhoto[])
      }

      const { data: ub } = await supabase
        .from('user_badges')
        .select('user_id, badges!inner(id, name, icon, color), profiles!inner(id, display_name, full_name, avatar_url)')
        .eq('event_id', eventId)
      if (cancelled) return

      type Row = {
        user_id: string
        badges: { id: string; name: string; icon: string; color: string }
        profiles: { id: string; display_name: string | null; full_name: string | null; avatar_url: string | null }
      }
      const byBadge = new Map<string, BadgeWinner>()
      for (const row of (ub ?? []) as unknown as Row[]) {
        const w = byBadge.get(row.badges.id) ?? {
          badge_id: row.badges.id,
          name: row.badges.name,
          icon: row.badges.icon,
          color: row.badges.color,
          earners: [],
        }
        w.earners.push({
          user_id: row.user_id,
          display_name: row.profiles.display_name ?? row.profiles.full_name ?? 'Wing lover',
          avatar_url: row.profiles.avatar_url,
        })
        byBadge.set(row.badges.id, w)
      }
      setWinners([...byBadge.values()].sort((a, b) => a.earners.length - b.earners.length))
    }
    load()
    return () => { cancelled = true }
  }, [eventId])

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.overall_rating, 0) / reviews.length).toFixed(1)
    : null

  const stats: Array<{ value: string; label: string }> = [
    { value: String(totalStops), label: totalStops === 1 ? 'stop' : 'stops' },
    { value: String(totalCheckins), label: 'check-ins' },
    { value: String(reviews.length), label: reviews.length === 1 ? 'review' : 'reviews' },
    ...(avgRating ? [{ value: avgRating, label: 'avg rating' }] : []),
  ]

  return (
    <>
      {/* Photo wall */}
      {photos.length > 0 && (
        <section>
          <h3 className="font-display uppercase text-lg text-night-900 tracking-tightest mb-3 px-1">The evidence</h3>
          <div className="grid grid-cols-3 gap-1.5">
            {photos.slice(0, 12).map(p => (
              <Link
                key={p.id}
                to={`/reviews/${p.review_id}`}
                className="block aspect-square rounded-xl overflow-hidden border-2 border-night-900"
              >
                <img src={p.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
              </Link>
            ))}
          </div>
          {photos.length > 12 && (
            <p className="text-xs text-charcoal-500 text-center mt-2">
              +{photos.length - 12} more in the gallery
            </p>
          )}
        </section>
      )}

      {/* Badge winners */}
      {winners.length > 0 && (
        <section className="card px-5 py-4">
          <h3 className="font-display uppercase text-base text-night-900 tracking-tightest mb-3">Bragging rights</h3>
          <ul className="space-y-2.5">
            {winners.map(w => (
              <li key={w.badge_id} className="flex items-center gap-3">
                <span
                  className="w-9 h-9 rounded-xl border-2 border-night-900 flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: w.color }}
                >
                  <BadgeIcon icon={w.icon} className="w-5 h-5 text-cream-50" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-night-900 uppercase tracking-crowd truncate">{w.name}</p>
                  <p className="text-xs text-charcoal-500 truncate">
                    {w.earners.map(e => e.display_name).join(', ')}
                  </p>
                </div>
                <div className="flex items-center flex-shrink-0">
                  {w.earners.slice(0, 4).map((e, i) => (
                    e.avatar_url ? (
                      <img
                        key={e.user_id}
                        src={e.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border-2 border-white"
                        style={{ marginLeft: i > 0 ? '-6px' : 0, position: 'relative', zIndex: 4 - i }}
                      />
                    ) : (
                      <span
                        key={e.user_id}
                        className="w-6 h-6 rounded-full bg-night-700 border-2 border-white flex items-center justify-center text-[10px] font-bold text-cream-50"
                        style={{ marginLeft: i > 0 ? '-6px' : 0, position: 'relative', zIndex: 4 - i }}
                      >
                        {e.display_name.charAt(0).toUpperCase()}
                      </span>
                    )
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {/* The numbers */}
      <section className="card px-5 py-4">
        <h3 className="font-display uppercase text-base text-night-900 tracking-tightest mb-3">The damage</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <p className="font-display text-2xl text-sauce-500 leading-none">{s.value}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-crowd text-charcoal-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
