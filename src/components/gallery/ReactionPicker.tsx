import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CommentReaction } from '../../lib/types'
import EmojiPicker from './EmojiPicker'

/** Quick-access emoji tray — shown inline before the "+" button */
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😍', '👏'] as const

interface Props {
  reactions: CommentReaction[]
  onToggle: (type: string) => void
  disabled?: boolean
  /** Compact mode hides the add button when there are no reactions */
  compact?: boolean
  /** Show a visible "React" label on the add button (44px tall pill). */
  showLabel?: boolean
}

export default function ReactionPicker({ reactions, onToggle, disabled, compact, showLabel }: Props) {
  const [showQuickTray, setShowQuickTray] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const [trayPos, setTrayPos] = useState<{ top: number; left: number } | null>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const trayRef = useRef<HTMLDivElement>(null)

  const byType = new Map(reactions.map(r => [r.reaction_type, r]))
  const hasAny = reactions.some(r => r.count > 0)

  // Existing reaction chips — always sorted with active ones first
  const activeReactions = reactions.filter(r => r.count > 0)

  const handlePickerSelect = useCallback((emoji: string) => {
    onToggle(emoji)
    setShowFullPicker(false)
    setShowQuickTray(false)
  }, [onToggle])

  const getAnchorRect = useCallback(() => {
    return addBtnRef.current?.getBoundingClientRect() ?? null
  }, [])

  // Where the quick tray goes: BELOW the button by default, so it never
  // covers the action row above it (Comment / Options); above only when
  // there's no room below. Clamped to the viewport horizontally.
  const placeTray = useCallback(() => {
    if (!addBtnRef.current) return
    const rect = addBtnRef.current.getBoundingClientRect()
    // 7 buttons × 44px + gaps + padding ≈ 332px wide, ~60px tall
    const trayW = 332
    const trayH = 60
    const pad = 8
    let top = rect.bottom + 6
    if (top + trayH > window.innerHeight - pad && rect.top - trayH - 6 >= pad) {
      top = rect.top - trayH - 6
    }
    let left = rect.left + rect.width / 2 - trayW / 2
    if (left + trayW > window.innerWidth - pad) left = window.innerWidth - pad - trayW
    if (left < pad) left = pad
    setTrayPos({ top, left })
  }, [])

  const openQuickTray = useCallback(() => {
    placeTray()
    setShowQuickTray(true)
  }, [placeTray])

  const closeQuickTray = useCallback((returnFocus = false) => {
    setShowQuickTray(false)
    if (returnFocus) addBtnRef.current?.focus()
  }, [])

  // While open: follow the button on scroll/resize, close on Escape, and
  // close on a tap anywhere else WITHOUT swallowing that tap (no invisible
  // full-screen layer), so e.g. "Comment" works on the first tap.
  useEffect(() => {
    if (!showQuickTray) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (trayRef.current?.contains(target) || addBtnRef.current?.contains(target)) return
      setShowQuickTray(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeQuickTray(true)
      }
    }
    window.addEventListener('scroll', placeTray, true)
    window.addEventListener('resize', placeTray)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', placeTray, true)
      window.removeEventListener('resize', placeTray)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [showQuickTray, placeTray, closeQuickTray])

  // Keyboard users land on the first emoji when the tray opens (once —
  // not again every time it repositions on scroll).
  const focusedTrayRef = useRef(false)
  useEffect(() => {
    if (!showQuickTray) { focusedTrayRef.current = false; return }
    if (focusedTrayRef.current || !trayRef.current) return
    focusedTrayRef.current = true
    trayRef.current.querySelector('button')?.focus({ preventScroll: true })
  }, [showQuickTray, trayPos])

  if (!hasAny && disabled) return null

  return (
    <div className="flex items-center gap-1 flex-wrap relative">
      {/* Existing reaction chips */}
      {activeReactions.map(r => {
        const mine = r.is_mine
        return (
          <button
            key={r.reaction_type}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(r.reaction_type)}
            aria-pressed={mine}
            aria-label={`${r.reaction_type} ${r.count}${mine ? ', you reacted' : ''}`}
            // 44px tall hit area around a compact pill
            className="group/chip inline-flex items-center min-h-[44px] -my-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <span className={`inline-flex items-center gap-1 px-2 py-1 min-h-[28px] rounded-full text-xs font-bold transition-all duration-150 group-active/chip:scale-95 ${
              mine
                ? 'bg-sauce-100 text-sauce-700 ring-1 ring-sauce-300'
                : 'bg-cream-100 text-charcoal-600 group-hover/chip:bg-cream-200'
            }`}>
              <span aria-hidden="true">{r.reaction_type}</span>
              <span aria-hidden="true">{r.count}</span>
            </span>
          </button>
        )
      })}

      {/* Add reaction button */}
      {!disabled && (
        <>
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => showQuickTray ? closeQuickTray() : openQuickTray()}
            aria-expanded={showQuickTray}
            aria-haspopup="true"
            className={`group/add inline-flex items-center justify-center rounded-full text-sm transition-all duration-150 ${
              showLabel
                ? `gap-1.5 min-h-[44px] px-3 text-xs font-bold ${
                    showQuickTray ? 'bg-sauce-100 text-sauce-500' : 'bg-cream-100 text-charcoal-500 hover:bg-cream-200'
                  }`
                // Compact: 44px hit area around a 32px visible circle
                : `w-11 h-11 -my-1.5 ${showQuickTray ? 'text-sauce-500' : 'text-charcoal-500'}`
            } ${!hasAny && compact ? 'opacity-60 group-hover:opacity-100 sm:opacity-0' : ''}`}
            title="Add reaction"
            aria-label={showLabel ? 'React: add a reaction' : 'Add reaction'}
          >
            {showLabel ? (
              <>
                <SmileIcon />
                <span>React</span>
              </>
            ) : (
              <span className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                showQuickTray ? 'bg-sauce-100' : 'bg-cream-100 group-hover/add:bg-cream-200'
              }`}>
                <SmileIcon />
              </span>
            )}
          </button>

          {/* Quick emoji tray — portaled to body with viewport-aware positioning */}
          {showQuickTray && trayPos &&
            createPortal(
              <>
                <div
                  ref={trayRef}
                  role="group"
                  aria-label="Choose a reaction"
                  className="fixed z-[195] animate-fade-in"
                  style={{ top: trayPos.top, left: trayPos.left }}
                >
                  <div className="bg-cream-50 rounded-2xl shadow-lg border-2 border-night-900 px-1.5 py-1.5 flex items-center gap-0.5 whitespace-nowrap">
                    {QUICK_EMOJIS.map(emoji => {
                      const existing = byType.get(emoji)
                      const mine = existing?.is_mine ?? false
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggle(emoji)
                            setShowQuickTray(false)
                          }}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-all duration-100
                            hover:bg-cream-100 active:scale-125 ${mine ? 'bg-sauce-50 ring-1 ring-sauce-200' : ''}`}
                          aria-label={`React with ${emoji}`}
                        >
                          {emoji}
                        </button>
                      )
                    })}
                    {/* More button → full picker */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowQuickTray(false)
                        setShowFullPicker(true)
                      }}
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-charcoal-500 hover:bg-cream-100 transition-colors"
                      title="More emoji"
                      aria-label="More emoji"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>,
              document.body
            )}
        </>
      )}

      {/* Full emoji picker */}
      {showFullPicker && (
        <EmojiPicker
          onSelect={handlePickerSelect}
          onClose={() => setShowFullPicker(false)}
          anchorRect={getAnchorRect()}
        />
      )}
    </div>
  )
}

function SmileIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  )
}

export { QUICK_EMOJIS }
