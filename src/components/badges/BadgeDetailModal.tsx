import { format } from 'date-fns'
import Modal from '../ui/Modal'
import type { BadgeWithEarned } from '../../lib/types'

interface Props {
  badge: BadgeWithEarned
  onClose: () => void
}

function howToEarn(b: BadgeWithEarned): string {
  const cfg = b.criteria_config ?? {}
  switch (b.criteria_type) {
    case 'first_review':        return 'Post your first review.'
    case 'review_count':        return `Post ${cfg.count ?? '?'} reviews.`
    case 'wing_size_variety':   return 'Review wings of every size: small, medium, large, and jumbo.'
    case 'event_rsvp':          return 'RSVP "I\'m in" to the event.'
    case 'event_checkin_count': return cfg.count === 1 ? 'Check in to any stop on the event route.' : `Check in to ${cfg.count} stops on the event route.`
    case 'event_complete':      return 'Check in to every stop on the event route.'
    case 'unique_spots':        return `Review wings at ${cfg.count ?? '?'} different spots.`
    case 'flavor_variety':      return `Try ${cfg.count ?? '?'} different wing flavors.`
    case 'lemon_pepper':        return 'Review a spot specifically for lemon pepper wings.'
    case 'ranch_fan':           return 'Review wings with ranch in the flavor — no shame.'
    case 'heat_seeker':         return 'Review ghost pepper, reaper, habanero, scorpion, or carolina wings.'
    case 'comment_count':       return `Leave ${cfg.count ?? '?'} comment${cfg.count === 1 ? '' : 's'} on reviews.`
    case 'avg_rating_high':     return `Maintain an average rating of ${cfg.min_avg ?? 9}+ across ${cfg.min_reviews ?? 5}+ reviews.`
    case 'avg_rating_low':      return `Maintain an average rating of ${cfg.max_avg ?? 4} or lower across ${cfg.min_reviews ?? 5}+ reviews.`
    case 'perfect_ten':         return 'Give a perfect 10/10 rating to a wing spot.'
    case 'takeout_count':       return `Review ${cfg.count ?? '?'} takeout orders.`
    case 'loyal_regular':       return `Review the same spot ${cfg.count ?? 3}+ times.`
    case 'jumbo_fan':           return 'Review a spot for jumbo wings.'
    default:                    return b.description ?? ''
  }
}

export default function BadgeDetailModal({ badge, onClose }: Props) {
  return (
    <Modal title="" onClose={onClose} size="sm">
      <div className="px-6 py-8 text-center bg-cream-50">
        {/* Badge icon plate */}
        <div className={`relative mx-auto w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mb-5 border-2 border-night-900
          ${badge.earned ? 'bg-night-800 shadow-sticker' : 'bg-cream-200 grayscale opacity-60'}`}
        >
          {badge.earned ? badge.icon : '🔒'}
          {badge.earned && (
            <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sauce-400 border-2 border-night-900 flex items-center justify-center text-xs">
              ✓
            </span>
          )}
        </div>

        <p className="eyebrow mb-1">Badge</p>
        <h3 className="font-display uppercase tracking-wide text-2xl text-night-900 mb-2 leading-tight">{badge.name}</h3>

        {badge.description && (
          <p className="text-sm text-charcoal-500 mb-4 leading-relaxed max-w-[220px] mx-auto">{badge.description}</p>
        )}

        {badge.earned ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-night-800 border-2 border-night-900 shadow-sticker-sm text-cream-50 text-xs font-extrabold uppercase tracking-crowd">
            <span className="text-sauce-300">✓</span>
            Earned{badge.earned_at ? ` · ${format(new Date(badge.earned_at), 'MMM d, yyyy')}` : ''}
          </div>
        ) : (
          <div className="bg-cream-100 border-2 border-night-900/20 rounded-xl px-4 py-3 text-left">
            <p className="eyebrow mb-1.5">How to earn</p>
            <p className="text-sm text-charcoal-600 leading-relaxed">{howToEarn(badge)}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
