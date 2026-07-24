import { useEffect, useMemo, useState } from 'react'
import BadgeIcon from './BadgeIcon'
import { BADGES_UNLOCKED_EVENT, BadgesUnlockedDetail } from '../../lib/badgeUnlocks'
import { badgeRarity, RARITY_CHIP_CLASSES } from '../../lib/badgeRarity'
import type { BadgeWithEarned } from '../../lib/types'

const CONFETTI_COLORS = ['#f73d2a', '#f1c12d', '#fdedb0', '#ff6e60', '#fffdf5', '#cf9b14']

interface Particle {
  left: string
  color: string
  size: number
  x: string
  y: string
  r: string
  d: string
  delay: string
  round: boolean
}

/** Deterministic-ish per-badge confetti so re-renders don't reshuffle mid-flight. */
function makeParticles(seedKey: string): Particle[] {
  let seed = 0
  for (let i = 0; i < seedKey.length; i++) seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0xffffffff
  }
  return Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + rand() * 0.5
    const dist = 90 + rand() * 150
    return {
      left: `${8 + rand() * 84}%`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 5 + Math.round(rand() * 6),
      x: `${Math.cos(angle) * dist}px`,
      y: `${120 + Math.sin(angle) * dist + rand() * 160}px`,
      r: `${360 + Math.round(rand() * 540)}deg`,
      d: `${1.1 + rand() * 0.9}s`,
      delay: `${rand() * 0.25}s`,
      round: rand() > 0.5,
    }
  })
}

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

  // A short celebratory buzz per badge, where the device supports it.
  useEffect(() => {
    if (!badge) return
    try { navigator.vibrate?.([35, 45, 70]) } catch { /* not supported */ }
  }, [badge?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const particles = useMemo(() => (badge ? makeParticles(badge.id) : []), [badge?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!badge) return null

  const hasMore = idx + 1 < batch.length
  const isEvent = !!badge.event_id
  const rarity = badgeRarity(badge.earned_count, badge.member_count)
  const isFirstEver = rarity != null && rarity.earnedCount <= 1

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
        className={`relative w-full max-w-sm bg-cream-50 border-2 rounded-3xl shadow-elevated px-6 py-8 text-center overflow-hidden animate-slide-up
          ${isEvent ? 'border-gold-400' : 'border-night-900'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti burst */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0">
          {particles.map((p, i) => (
            <span
              key={i}
              className="animate-confetti absolute block"
              style={{
                left: p.left,
                top: '-8px',
                width: p.size,
                height: p.round ? p.size : p.size * 1.8,
                backgroundColor: p.color,
                borderRadius: p.round ? '9999px' : '2px',
                animationDelay: p.delay,
                ['--confetti-x' as string]: p.x,
                ['--confetti-y' as string]: p.y,
                ['--confetti-r' as string]: p.r,
                ['--confetti-d' as string]: p.d,
              }}
            />
          ))}
        </div>

        {isEvent && (
          <p className="inline-flex items-center gap-1.5 mb-4 px-3 py-1 rounded-full bg-gold-300 border-2 border-night-900 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm animate-rise-in">
            ★ Event exclusive
          </p>
        )}

        {/* Badge plate with rotating rays behind it */}
        <div className="relative mx-auto w-32 h-32 mb-4 flex items-center justify-center">
          <div
            aria-hidden="true"
            className="animate-rays-spin absolute inset-[-28px] opacity-70"
            style={{
              background: `repeating-conic-gradient(${isEvent ? '#f1c12d' : '#ff6e60'} 0deg 11deg, transparent 11deg 30deg)`,
              WebkitMaskImage: 'radial-gradient(circle, transparent 34%, black 40%, black 62%, transparent 70%)',
              maskImage: 'radial-gradient(circle, transparent 34%, black 40%, black 62%, transparent 70%)',
              borderRadius: '9999px',
            }}
          />
          <div
            className={`animate-badge-pop relative w-24 h-24 rounded-2xl flex items-center justify-center text-5xl border-2 bg-night-800 text-cream-50
              ${isEvent ? 'border-gold-400 shadow-sticker-gold' : 'border-night-900 shadow-sticker'}`}
          >
            <BadgeIcon icon={badge.icon} className="w-12 h-12" />
            <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full border-2 border-night-900 flex items-center justify-center text-xs
              ${isEvent ? 'bg-gold-300' : 'bg-sauce-400'}`}>
              {isEvent ? '★' : '✓'}
            </span>
          </div>
        </div>

        <p className={`eyebrow mb-1 animate-rise-in ${isEvent ? 'text-gold-500' : 'text-sauce-500'}`} style={{ animationDelay: '0.15s' }}>
          Badge unlocked!
        </p>
        <h3
          className="font-display uppercase tracking-wide text-3xl text-night-900 mb-2 leading-none animate-rise-in"
          style={{ animationDelay: '0.22s' }}
        >
          {badge.name}
        </h3>

        {badge.description && (
          <p
            className="text-sm text-charcoal-500 leading-relaxed max-w-[240px] mx-auto mb-3 animate-rise-in"
            style={{ animationDelay: '0.3s' }}
          >
            {badge.description}
          </p>
        )}

        {isEvent && badge.event_name && (
          <p className="text-xs font-extrabold uppercase tracking-crowd text-gold-500 mb-3 animate-rise-in" style={{ animationDelay: '0.34s' }}>
            ★ Earned at {badge.event_name}
          </p>
        )}

        {rarity && (
          <div className="flex items-center justify-center gap-2 mb-5 animate-rise-in" style={{ animationDelay: '0.38s' }}>
            {isFirstEver ? (
              <span className="px-3 py-1 rounded-md border-2 border-night-900 bg-gold-300 text-night-900 text-[11px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
                🏆 First to earn this!
              </span>
            ) : (
              <>
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-crowd ${RARITY_CHIP_CLASSES[rarity.tier]}`}>
                  {rarity.label}
                </span>
                <span className="text-[11px] text-charcoal-500 font-bold">
                  {rarity.tier === 'common'
                    ? `${rarity.earnedCount} of ${rarity.memberCount} members have this`
                    : `Only ${rarity.pct}% of members have this`}
                </span>
              </>
            )}
          </div>
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
