import { useState } from 'react'
import BadgePill from './BadgePill'
import BadgeDetailModal from './BadgeDetailModal'
import type { BadgeWithEarned } from '../../lib/types'

interface Props {
  badges: BadgeWithEarned[]
  emptyMessage?: string
}

export default function BadgeGrid({ badges, emptyMessage }: Props) {
  const [selected, setSelected] = useState<BadgeWithEarned | null>(null)

  if (badges.length === 0) {
    return (
      <p className="text-xs text-charcoal-400 italic">{emptyMessage ?? 'No badges yet.'}</p>
    )
  }

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {badges.map(b => (
          <BadgePill key={b.id} badge={b} onClick={() => setSelected(b)} />
        ))}
      </div>
      {selected && (
        <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
