import BadgeIcon from './BadgeIcon'
import type { BadgeWithEarned, Badge } from '../../lib/types'

interface Props {
  badge: BadgeWithEarned | Badge
  onClick?: () => void
  size?: 'sm' | 'md'
}

function isEarned(b: BadgeWithEarned | Badge): boolean {
  return 'earned' in b ? b.earned : true
}

export default function BadgePill({ badge, onClick, size = 'md' }: Props) {
  const earned = isEarned(badge)
  const isEvent = !!badge.event_id
  const interactive = !!onClick
  const pad  = size === 'sm' ? 'px-2 py-2' : 'px-3 py-3'
  const icon = size === 'sm' ? 'text-xl' : 'text-2xl'

  // Gold = event exclusive, everywhere. Earned event badges get the gold
  // frame; locked ones keep the lock but hint gold so members can tell an
  // exclusive apart from a regular locked badge.
  const frame = earned
    ? isEvent
      ? 'bg-night-800 border-gold-400 text-cream-50 shadow-sticker-gold hover:bg-night-700 cursor-pointer'
      : 'bg-night-800 border-night-900 text-cream-50 shadow-sticker-sm hover:shadow-sticker hover:bg-night-700 cursor-pointer'
    : isEvent
      ? 'bg-cream-100 border-dashed border-gold-400/70 text-charcoal-400 opacity-60 cursor-default'
      : 'bg-cream-100 border-night-900/20 text-charcoal-400 opacity-50 grayscale cursor-default'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      title={isEvent ? `${badge.name} · Event exclusive` : badge.name}
      className={`relative ${pad} rounded-xl flex flex-col items-center justify-center text-center
        border-2 transition-all duration-150 select-none ${frame}
        ${interactive && earned ? 'active:translate-x-[1px] active:translate-y-[1px] active:shadow-none' : ''}`}
    >
      {isEvent && (
        <span
          aria-hidden="true"
          data-testid="event-star"
          className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border flex items-center justify-center text-[8px] leading-none
            ${earned ? 'bg-gold-300 border-night-900' : 'bg-cream-200 border-gold-400/70'}`}
        >
          ★
        </span>
      )}
      <span className={`${icon} mb-1 leading-none flex items-center justify-center`}>
        {earned
          ? <BadgeIcon icon={badge.icon} className={size === 'sm' ? 'w-6 h-6' : 'w-7 h-7'} />
          : '🔒'}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-crowd leading-tight">
        {badge.name}
      </span>
    </button>
  )
}
