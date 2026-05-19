import { format } from 'date-fns'
import Modal from '../ui/Modal'
import type { BadgeWithEarned } from '../../lib/types'

interface Props {
  badge: BadgeWithEarned
  onClose: () => void
}

function howToEarn(b: BadgeWithEarned): string {
  switch (b.criteria_type) {
    case 'first_review':
      return 'Post your first review.'
    case 'review_count':
      return `Post ${b.criteria_config?.count ?? '?'} reviews.`
    case 'wing_size_variety':
      return 'Post reviews covering small, medium, large, and jumbo wings.'
    case 'event_rsvp':
      return 'RSVP "I\'m in" to the event.'
    case 'event_checkin_count': {
      const n = b.criteria_config?.count ?? 1
      return n === 1
        ? 'Check in to any stop on the event route.'
        : `Check in to ${n} stops on the event route.`
    }
    case 'event_complete':
      return 'Check in to every stop on the event route.'
    default:
      return b.description ?? ''
  }
}

export default function BadgeDetailModal({ badge, onClose }: Props) {
  return (
    <Modal title="Badge" onClose={onClose} size="sm">
      <div className="px-6 py-8 text-center">
        <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center text-5xl mb-4 ${
          badge.earned
            ? 'bg-amber-100 shadow-soft'
            : 'bg-warmgray-100 grayscale opacity-60'
        }`}>
          {badge.earned ? badge.icon : '🔒'}
        </div>
        <h3 className="font-display text-xl text-charcoal-800 mb-1">{badge.name}</h3>
        {badge.description && (
          <p className="text-sm text-charcoal-500 mb-3 leading-relaxed">{badge.description}</p>
        )}
        {badge.earned ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold">
            ✓ Earned {badge.earned_at && format(new Date(badge.earned_at), 'MMM d, yyyy')}
          </div>
        ) : (
          <div className="text-xs text-charcoal-400 bg-warmgray-50 rounded-xl px-4 py-3 mt-2">
            <p className="font-semibold uppercase tracking-widest text-[10px] mb-1">How to earn</p>
            <p>{howToEarn(badge)}</p>
          </div>
        )}
      </div>
    </Modal>
  )
}
