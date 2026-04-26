import { useCallback, useRef, useState } from 'react'

interface Props {
  /** Current value, 0 (empty) or 1.0 – 10.0 in 0.1 increments. */
  value: number
  onChange: (value: number) => void
  /** Color theme — pick whichever matches your app's primary accent. */
  accent?: 'rose' | 'amber'
  /** Optional emoji or short string shown to the left of the value. */
  icon?: string
  /** Optional inline label, e.g. "Coffee" or "Wings". */
  label?: string
  /** Override min (default 1.0) — set to 0 to allow "no rating yet". */
  min?: number
  max?: number
  /** Disable input. */
  disabled?: boolean
}

const ACCENT_CLASSES: Record<NonNullable<Props['accent']>, {
  fill: string
  fillBg: string
  ring: string
  text: string
  chip: string
  chipActive: string
}> = {
  rose: {
    fill: 'text-rose-400',
    fillBg: 'bg-rose-400',
    ring: 'focus-visible:ring-rose-300',
    text: 'text-rose-500',
    chip: 'bg-cream-100 text-espresso-600 hover:bg-cream-200 active:bg-cream-300',
    chipActive: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200',
  },
  amber: {
    fill: 'text-amber-400',
    fillBg: 'bg-amber-400',
    ring: 'focus-visible:ring-amber-300',
    text: 'text-amber-500',
    chip: 'bg-warmgray-100 text-charcoal-600 hover:bg-warmgray-200 active:bg-warmgray-300',
    chipActive: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200',
  },
}

const round1 = (v: number) => Math.round(v * 10) / 10

export default function RatingPicker({
  value,
  onChange,
  accent = 'amber',
  icon,
  label,
  min = 1,
  max = 10,
  disabled = false,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const colors = ACCENT_CLASSES[accent]

  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, round1(v))),
    [min, max]
  )

  const setVal = useCallback(
    (v: number) => {
      const next = clamp(v)
      if (next !== value) {
        onChange(next)
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(6)
        }
      }
    },
    [value, onChange, clamp]
  )

  const valueFromX = useCallback(
    (clientX: number): number => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return value
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      // Map [0,1] → [min, max] in 0.1 steps, biased so dragging to the start
      // hits min (1.0) cleanly even when finger is slightly off the edge.
      return round1(min + pct * (max - min))
    },
    [value, min, max]
  )

  // Pointer handlers — capture so dragging continues outside the track
  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setVal(valueFromX(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (disabled || !dragging) return
    setVal(valueFromX(e.clientX))
  }
  const endDrag = () => setDragging(false)

  // Keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    let next = value
    const big = e.shiftKey ? 1.0 : 0.1
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - big
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + big
        break
      case 'PageDown':
        next = value - 1
        break
      case 'PageUp':
        next = value + 1
        break
      case 'Home':
        next = min
        break
      case 'End':
        next = max
        break
      default:
        return
    }
    e.preventDefault()
    setVal(next)
  }

  // Stepper helpers
  const step = (delta: number) => () => setVal(value + delta)

  // Render proportional star fill: each of `max` stars receives a fillPct.
  const fillForIndex = (i: number) => {
    // i is 0-based. Star i represents the range [i, i+1].
    const v = value - i
    return Math.max(0, Math.min(1, v))
  }

  // Visual percentage for the value display bar
  const range = max - min
  const valuePct = range === 0 ? 0 : Math.max(0, Math.min(100, ((value - min) / range) * 100))

  return (
    <div className="select-none">
      {/* Top row: label + big value */}
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-base flex-shrink-0" aria-hidden>{icon}</span>}
          {label && (
            <span className={`text-xs font-semibold uppercase tracking-widest ${
              accent === 'rose' ? 'text-espresso-400' : 'text-charcoal-400'
            }`}>
              {label}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 flex-shrink-0">
          <span
            className={`font-display text-3xl font-bold tabular-nums leading-none transition-colors ${
              value > 0 ? colors.text : (accent === 'rose' ? 'text-cream-300' : 'text-warmgray-300')
            }`}
            aria-live="polite"
          >
            {value > 0 ? value.toFixed(1) : '—'}
          </span>
          <span className={`text-xs font-medium tabular-nums ${
            accent === 'rose' ? 'text-espresso-300' : 'text-charcoal-300'
          }`}>
            / {max.toFixed(0)}
          </span>
        </div>
      </div>

      {/* Star track — drag/tap surface */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={value > 0 ? `${value.toFixed(1)} out of ${max}` : 'No rating'}
        aria-label={label ? `${label} rating` : 'Rating'}
        aria-disabled={disabled}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={onKeyDown}
        className={`relative flex items-center justify-between w-full
                    py-2 px-1 rounded-xl
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer touch-none'}
                    focus:outline-none ${colors.ring} focus-visible:ring-2`}
        style={{ touchAction: 'none' }}
      >
        {/* Subtle progress bar behind stars (shows fill at a glance) */}
        <span
          className={`absolute left-1 right-1 bottom-0.5 h-0.5 rounded-full ${
            accent === 'rose' ? 'bg-cream-200' : 'bg-warmgray-200'
          }`}
          aria-hidden
        />
        <span
          className={`absolute left-1 bottom-0.5 h-0.5 rounded-full ${colors.fillBg} transition-[width] duration-100`}
          style={{ width: `calc((100% - 0.5rem) * ${valuePct / 100})` }}
          aria-hidden
        />

        {Array.from({ length: max }, (_, i) => (
          <ProportionalStar
            key={i}
            fill={fillForIndex(i)}
            accent={accent}
            active={dragging && fillForIndex(i) > 0}
          />
        ))}
      </div>

      {/* Stepper chips */}
      <div className="mt-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Stepper colors={colors} disabled={disabled || value <= min} onClick={step(-1)} aria-label="Decrease by 1">−1</Stepper>
          <Stepper colors={colors} disabled={disabled || value <= min} onClick={step(-0.1)} aria-label="Decrease by 0.1">−.1</Stepper>
        </div>
        <p className={`text-[10px] font-medium tabular-nums ${
          accent === 'rose' ? 'text-espresso-300' : 'text-charcoal-300'
        }`}>
          drag • tap • ← →
        </p>
        <div className="flex items-center gap-1.5">
          <Stepper colors={colors} disabled={disabled || value >= max} onClick={step(0.1)} aria-label="Increase by 0.1">+.1</Stepper>
          <Stepper colors={colors} disabled={disabled || value >= max} onClick={step(1)} aria-label="Increase by 1">+1</Stepper>
        </div>
      </div>
    </div>
  )
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function ProportionalStar({
  fill,
  accent,
  active,
}: {
  fill: number
  accent: 'rose' | 'amber'
  active: boolean
}) {
  const pct = Math.max(0, Math.min(1, fill)) * 100
  const filledColor = accent === 'rose' ? 'text-rose-400' : 'text-amber-400'
  const emptyColor = accent === 'rose' ? 'text-cream-300' : 'text-warmgray-300'
  return (
    <span
      className={`relative inline-block leading-none text-2xl sm:text-[26px] transition-transform ${
        active ? 'scale-110' : ''
      }`}
      aria-hidden
    >
      <span className={emptyColor}>★</span>
      <span
        className={`absolute inset-0 overflow-hidden ${filledColor}`}
        style={{ width: `${pct}%` }}
      >
        ★
      </span>
    </span>
  )
}

function Stepper({
  children,
  onClick,
  disabled,
  colors,
  ...rest
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  colors: typeof ACCENT_CLASSES['amber']
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums
                  transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                  ${colors.chip}`}
      {...rest}
    >
      {children}
    </button>
  )
}

// Re-export to keep parent imports tidy
export type { Props as RatingPickerProps }
