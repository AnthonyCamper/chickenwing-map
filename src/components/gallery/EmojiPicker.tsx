import { useRef, useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBottomSheetDrag, useIsMobile } from '../../hooks/useBottomSheetDrag'

// ── Emoji data: compact curated set organized by category ──────────────────

const CATEGORIES = [
  {
    id: 'recent',
    label: 'Recent',
    icon: '🕐',
    emojis: [] as string[], // populated dynamically
  },
  {
    id: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊',
      '😇','🥰','😍','🤩','😘','😗','😋','😛','😜','🤪',
      '😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏',
      '😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴',
      '😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯',
      '🥳','🤠','😎','🤓','🧐','😳','🥺','😢','😭','😤',
      '😠','😡','🤬','💀','☠️','💩','🤡','👻','👽','🫡',
    ],
  },
  {
    id: 'gestures',
    label: 'Gestures',
    icon: '👍',
    emojis: [
      '👍','👎','👊','✊','🤛','🤜','👏','🙌','🤝','🫶',
      '👐','🤲','🤞','✌️','🤟','🤘','🫰','👌','🤌','🤏',
      '👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋',
      '🤙','💪','🦾','🙏','✍️','🫵','🫱','🫲',
    ],
  },
  {
    id: 'hearts',
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💖',
      '💝','💘','💕','💞','💓','💗','💔','❤️‍🔥','❤️‍🩹','🩷',
      '🩵','🩶',
    ],
  },
  {
    id: 'food',
    label: 'Food',
    icon: '☕',
    emojis: [
      '☕','🍵','🧋','🥤','🍺','🍻','🥂','🍷','🍸','🍹',
      '🧃','🥛','🍼','🍔','🍕','🌮','🌯','🥗','🍜','🍝',
      '🍣','🍱','🍰','🎂','🍩','🍪','🍫','🍬','🍭','🍿',
      '🧁','🥐','🥑','🍓','🫐','🍑','🍒','🥝','🍌',
    ],
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: '🌿',
    emojis: [
      '🌸','🌺','🌻','🌹','🌷','💐','🌿','🍀','🍃','🍂',
      '🍁','🌴','🌵','🌲','🌳','🐶','🐱','🐻','🦊','🐰',
      '🐼','🐨','🦁','🐮','🐷','🐸','🐵','🦋','🐝','🐞',
      '🌈','⭐','🌟','✨','⚡','🔥','💧','🌊','☀️','🌙',
    ],
  },
  {
    id: 'objects',
    label: 'Objects',
    icon: '🎵',
    emojis: [
      '🎵','🎶','🎸','🎹','🥁','🎺','🎻','🎤','🎧','📱',
      '💻','⌨️','📷','📸','🎬','🎨','🎭','🏆','🥇','🎯',
      '🎮','🎲','🧩','🎪','🎡','💡','📚','📖','✏️','💰',
      '💎','🔔','🔑','🗝️','🧲','🪄','🎁','🎈','🎀','🏠',
    ],
  },
  {
    id: 'symbols',
    label: 'Symbols',
    icon: '💯',
    emojis: [
      '💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️',
      '🗨️','🗯️','💤','💮','♻️','✅','❌','❓','❗','‼️',
      '⭕','🚫','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪',
      '🏳️‍🌈','🏴‍☠️','🚀','🛸','🎉','🎊','🪩',
    ],
  },
] as const

const RECENT_KEY = 'emoji_recent'
const MAX_RECENT = 24

function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function addRecentEmoji(emoji: string) {
  const recent = getRecentEmojis().filter(e => e !== emoji)
  recent.unshift(emoji)
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent))
  } catch {
    // ignore
  }
}

// ── Main component ─────────────────────────────────────────────────────────

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  /** Position for desktop popover mode */
  anchorRect?: DOMRect | null
}

export default function EmojiPicker({ onSelect, onClose, anchorRect }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState('recent')
  const scrollRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const isDesktop = !useIsMobile()

  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({
    defaultMaxHeight: 'calc(55dvh - env(safe-area-inset-top))',
    expandedMaxHeight: 'calc(100dvh - env(safe-area-inset-top))',
  })

  // Build categories with recent
  const recent = getRecentEmojis()
  const categories = CATEGORIES.map(cat =>
    cat.id === 'recent' ? { ...cat, emojis: recent } : cat
  ).filter(cat => cat.id !== 'recent' || cat.emojis.length > 0)

  // Start on first real category if no recents
  useEffect(() => {
    if (recent.length === 0 && activeCategory === 'recent') {
      setActiveCategory('smileys')
    }
  }, [recent.length, activeCategory])

  const handleSelect = useCallback((emoji: string) => {
    addRecentEmoji(emoji)
    onSelect(emoji)
    onClose()
  }, [onSelect, onClose])

  const scrollToCategory = useCallback((id: string) => {
    setActiveCategory(id)
    const el = categoryRefs.current[id]
    if (el && scrollRef.current) {
      const top = el.offsetTop - scrollRef.current.offsetTop
      scrollRef.current.scrollTo({ top, behavior: 'smooth' })
    }
  }, [])

  // Track active category on scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const scrollTop = scrollRef.current.scrollTop + 60
    let current = categories[0]?.id ?? 'smileys'
    for (const cat of categories) {
      const el = categoryRefs.current[cat.id]
      if (el && el.offsetTop - scrollRef.current.offsetTop <= scrollTop) {
        current = cat.id
      }
    }
    setActiveCategory(current)
  }, [categories])

  // Mobile sheet: lock body scroll (iOS-safe variant) so reaching the end of
  // the emoji grid doesn't chain-scroll the feed underneath.
  useEffect(() => {
    if (isDesktop) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [isDesktop])

  // Close on outside click for desktop popover
  useEffect(() => {
    if (!isDesktop) return
    const handle = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-emoji-picker]')) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isDesktop, onClose])

  const pickerContent = (
    <div
      data-emoji-picker
      className={
        isDesktop && anchorRect
          ? 'fixed z-[210] bg-white rounded-2xl shadow-2xl border border-warmgray-200 w-[340px] max-h-[380px] flex flex-col overflow-hidden animate-fade-in'
          : 'relative w-full max-w-lg bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up'
      }
      style={
        isDesktop && anchorRect
          ? {
              top: Math.min(anchorRect.top, window.innerHeight - 400),
              left: Math.min(anchorRect.right + 8, window.innerWidth - 356),
            }
          : sheetStyle
      }
      onClick={e => e.stopPropagation()}
    >
      {/* Handle (mobile only) */}
      {!isDesktop && (
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          role="slider"
          aria-label={expanded ? 'Drag down to collapse' : 'Drag up to expand'}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={expanded ? 1 : 0}
          tabIndex={0}
          {...handleProps}
        >
          <div className={`w-10 h-1 rounded-full transition-colors duration-200 ${expanded ? 'bg-warmgray-300' : 'bg-warmgray-200'}`} />
        </div>
      )}

      {/* Category tabs */}
      <div className="flex px-2 pt-2 pb-0.5 gap-0.5 overflow-x-auto scrollbar-hide flex-shrink-0">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base transition-colors ${
              activeCategory === cat.id
                ? 'bg-amber-100 text-amber-600'
                : 'hover:bg-warmgray-100 text-charcoal-500'
            }`}
            title={cat.label}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3 min-h-0"
        style={{ maxHeight: isDesktop ? '280px' : undefined }}
      >
        {categories.map(cat => (
          <div
            key={cat.id}
            ref={el => { categoryRefs.current[cat.id] = el }}
          >
            <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider px-1 pt-2.5 pb-1">
              {cat.label}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {cat.emojis.map((emoji, i) => (
                <EmojiButton key={`${cat.id}-${emoji}-${i}`} emoji={emoji} onSelect={handleSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // Desktop: popover portal
  if (isDesktop && anchorRect) {
    return createPortal(pickerContent, document.body)
  }

  // Mobile: bottom sheet portal
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      {pickerContent}
    </div>,
    document.body
  )
}

// ── Emoji button ───────────────────────────────────────────────────────────

function EmojiButton({ emoji, onSelect }: { emoji: string; onSelect: (e: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(emoji)}
      className="w-full aspect-square rounded-xl flex items-center justify-center text-xl
                 hover:bg-warmgray-100 active:bg-warmgray-200 active:scale-110 transition-all duration-100"
    >
      {emoji}
    </button>
  )
}
