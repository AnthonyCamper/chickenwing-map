import { format } from 'date-fns'
import Modal from '../ui/Modal'
import BadgeIcon from './BadgeIcon'
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
    case 'event_rsvp':              return 'RSVP "I\'m in" to the event.'
    case 'event_rsvp_with_guests':  return 'RSVP "I\'m in" to the event and bring guests.'
    case 'event_checkin_count':     return cfg.count === 1 ? 'Check in to any stop on the event route.' : `Check in to ${cfg.count} stops on the event route.`
    case 'event_complete':          return 'Check in to every stop on the event route.'
    case 'event_first_checkin':     return 'Be the first person to check in at any stop on the event route.'
    case 'event_review_count':      return 'Leave at least one review during the event.'
    case 'event_review_all':        return 'Leave a review at every stop you check into.'
    case 'unique_spots':            return `Review wings at ${cfg.count ?? '?'} different spots.`
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
    case 'jumbo_fan':             return 'Review a spot for jumbo wings.'
    case 'review_text_contains':  return cfg.hint
      ?? (cfg.word ? `Mention "${cfg.word}" in a review.` : `Use a specific phrase in a review.`)
    case 'review_text_long':      return `Write a review with at least ${cfg.min_length ?? 300} characters. Go deep.`
    case 'review_text_short':     return `Write a review with ${cfg.max_length ?? 15} characters or fewer. Say it in style.`
    case 'single_rating_low':     return `Give a rating of ${cfg.max_rating ?? 2}.0 or below on any review.`
    case 'rating_floor':          return `Never give below a ${cfg.min_rating ?? 8}.0, with at least ${cfg.min_reviews ?? 5} reviews.`
    case 'rating_no_decimals':    return `Give at least ${cfg.min_reviews ?? 3} reviews and never use a decimal — whole numbers only.`
    case 'rating_uses_decimals':  return 'Use a decimal rating at least once (e.g. 7.5, 8.3).'
    case 'rating_exact':          return cfg.hint ?? `Give a rating of exactly ${cfg.value ?? '?'}.`
    case 'flavor_contains':       return `Review wings with ${cfg.text ?? 'a specific'} flavor.`
    default:                      return b.description ?? ''
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
          {badge.earned ? <BadgeIcon icon={badge.icon} className="w-12 h-12" /> : '🔒'}
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
