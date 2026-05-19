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
  const interactive = !!onClick
  const padding = size === 'sm' ? 'px-2 py-2' : 'px-3 py-3'
  const iconSize = size === 'sm' ? 'text-xl' : 'text-2xl'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      title={badge.name}
      className={`${padding} rounded-2xl flex flex-col items-center justify-center text-center border transition-all ${
        earned
          ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
          : 'bg-warmgray-50 border-warmgray-200 text-charcoal-400 opacity-60 grayscale'
      } ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className={`${iconSize} mb-0.5 ${earned ? '' : 'opacity-50'}`}>
        {earned ? badge.icon : '🔒'}
      </span>
      <span className="text-[10px] font-semibold leading-tight">
        {badge.name}
      </span>
    </button>
  )
}
