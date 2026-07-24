import { useEffect, useState } from 'react'
import BadgeIcon from './BadgeIcon'
import { BADGES_UNLOCKED_EVENT, BadgesUnlockedDetail } from '../../lib/badgeUnlocks'
import type { BadgeWithEarned } from '../../lib/types'

/**
 * Full-screen "Badge unlocked!" celebration. Mounted once in App; shows
 * whenever a badges-unlocked window event fires (see lib/badgeUnlocks).
 * Multiple badges earned by the same action queue up and are presented
 * one at a time ("2 of 3") so each gets its moment.
 */
export default function BadgeUnlockOverlay() {
  const [batch, setBatch] = useState<BadgeWithEarned[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const handler = (e: Event) => {
      const badges = (e as CustomEvent<BadgesUnlockedDetail>).detail?.badges
      if (!badges?.length) return
      setBatch(prev => (prev.length === 0 ? badges : [...prev, ...badges]))
    }
    window.addEventListener(BADGES_UNLOCKED_EVENT, handler)
    return () => window.removeEventListener(BADGES_UNLOCKED_EVENT, handler)
  }, [])

  const badge = batch[idx]

  const advance = () => {
    if (idx + 1 < batch.length) {
      setIdx(idx + 1)
    } else {
      setBatch([])
      setIdx(0)
    }
  }

  useEffect(() => {
    if (!badge) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') advance()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [badge, idx, batch.length])

  if (!badge) return null

  const hasMore = idx + 1 < batch.length

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center px-6 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Badge unlocked: ${badge.name}`}
      onClick={advance}
    >
      <div className="absolute inset-0 bg-night-900/70 backdrop-blur-sm" />

      <div
        key={badge.id}
        className="relative w-full max-w-sm bg-cream-50 border-2 border-night-900 rounded-3xl shadow-elevated px-6 py-8 text-center animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti accents */}
        <span aria-hidden="true" className="absolute -top-3 left-6 text-2xl rotate-[-12deg]">🎉</span>
        <span aria-hidden="true" className="absolute -top-2 right-8 text-xl rotate-[15deg]">✨</span>

        {/* Badge plate — same visual language as BadgeDetailModal */}
        <div className="relative mx-auto w-24 h-24 rounded-2xl flex items-center justify-center text-5xl mb-5 border-2 border-night-900 bg-night-800 text-cream-50 shadow-sticker">
          <BadgeIcon icon={badge.icon} className="w-12 h-12" />
          <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-sauce-400 border-2 border-night-900 flex items-center justify-center text-xs">
            ✓
          </span>
        </div>

        <p className="eyebrow mb-1 text-sauce-500">Badge unlocked!</p>
        <h3 className="font-display uppercase tracking-wide text-3xl text-night-900 mb-2 leading-none">
          {badge.name}
        </h3>

        {badge.description && (
          <p className="text-sm text-charcoal-500 leading-relaxed max-w-[240px] mx-auto mb-5">
            {badge.description}
          </p>
        )}

        {batch.length > 1 && (
          <p className="text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-400 mb-3">
            {idx + 1} of {batch.length}
          </p>
        )}

        <button type="button" onClick={advance} className="btn-primary w-full py-3">
          {hasMore ? 'Next badge →' : 'Wear it proud'}
        </button>
      </div>
    </div>
  )
}
