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
}

export default function ReactionPicker({ reactions, onToggle, disabled, compact }: Props) {
  const [showQuickTray, setShowQuickTray] = useState(false)
  const [showFullPicker, setShowFullPicker] = useState(false)
  const [trayPos, setTrayPos] = useState<{ top: number; left: number } | null>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

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

  // Calculate tray position when opened, keeping it within viewport
  const openQuickTray = useCallback(() => {
    if (!addBtnRef.current) return
    const rect = addBtnRef.current.getBoundingClientRect()
    // Tray is ~7 buttons * 36px + padding ≈ 280px wide, ~44px tall
    const trayW = 290
    const trayH = 48
    const pad = 8

    // Position above the button, centered
    let top = rect.top - trayH - 6
    let left = rect.left + rect.width / 2 - trayW / 2

    // Clamp to viewport
    if (left < pad) left = pad
    if (left + trayW > window.innerWidth - pad) left = window.innerWidth - pad - trayW
    if (top < pad) top = rect.bottom + 6 // flip below if no room above

    setTrayPos({ top, left })
    setShowQuickTray(true)
  }, [])

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!showQuickTray) return
    const reposition = () => {
      if (!addBtnRef.current) return
      const rect = addBtnRef.current.getBoundingClientRect()
      const trayW = 290
      const trayH = 48
      const pad = 8
      let top = rect.top - trayH - 6
      let left = rect.left + rect.width / 2 - trayW / 2
      if (left < pad) left = pad
      if (left + trayW > window.innerWidth - pad) left = window.innerWidth - pad - trayW
      if (top < pad) top = rect.bottom + 6
      setTrayPos({ top, left })
    }
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [showQuickTray])

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
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150 ${
              mine
                ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                : 'bg-warmgray-100 text-charcoal-600 hover:bg-warmgray-200'
            } disabled:opacity-50 disabled:pointer-events-none active:scale-95`}
          >
            <span>{r.reaction_type}</span>
            <span>{r.count}</span>
          </button>
        )
      })}

      {/* Add reaction button */}
      {!disabled && (
        <>
          <button
            ref={addBtnRef}
            type="button"
            onClick={() => showQuickTray ? setShowQuickTray(false) : openQuickTray()}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm transition-all duration-150 ${
              showQuickTray
                ? 'bg-amber-100 text-amber-500'
                : 'bg-warmgray-50 text-charcoal-400 hover:bg-warmgray-100'
            } ${!hasAny && compact ? 'opacity-0 group-hover:opacity-100' : ''}`}
            title="Add reaction"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* Quick emoji tray — portaled to body with viewport-aware positioning */}
          {showQuickTray && trayPos &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[190]"
                  onClick={() => setShowQuickTray(false)}
                />
                <div
                  className="fixed z-[195] animate-fade-in"
                  style={{ top: trayPos.top, left: trayPos.left }}
                >
                  <div className="bg-white rounded-2xl shadow-lg border border-warmgray-200 px-1.5 py-1.5 flex items-center gap-0.5 whitespace-nowrap">
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
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-100
                            hover:bg-warmgray-100 active:scale-125 ${mine ? 'bg-amber-50 ring-1 ring-amber-200' : ''}`}
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
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-charcoal-400 hover:bg-warmgray-100 transition-colors"
                      title="More emoji"
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

export { QUICK_EMOJIS }
