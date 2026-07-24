import { useEffect, useState, ReactNode, useId } from 'react'
import { createPortal } from 'react-dom'
import { useBottomSheetDrag, useIsMobile } from '../../hooks/useBottomSheetDrag'
import { useFocusTrap } from '../../hooks/useFocusTrap'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

// Module-level stack of open modals so Escape only dismisses the topmost one
// when modals are nested (e.g. edit modal above a detail sheet).
const modalStack: symbol[] = []

export default function Modal({ title, onClose, children, size = 'md' }: Props) {
  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({ onDismiss: onClose })
  const panelRef = useFocusTrap<HTMLDivElement>()
  const titleId = useId()
  const [stackId] = useState(() => Symbol('modal'))
  const isMobile = useIsMobile()

  // Keep the sheet above the iOS keyboard: 100dvh ignores the keyboard, so
  // shrink and lift the bottom-anchored sheet by the overlap (same pattern
  // as PhotoModal's mobile sheet).
  const [keyboardInset, setKeyboardInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setKeyboardInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  // Lock body scroll while modal is open (prevents double-scroll on iOS)
  // Saves and restores scroll position to prevent the jump caused by position:fixed
  useEffect(() => {
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
  }, [])

  useEffect(() => {
    modalStack.push(stackId)
    return () => {
      const idx = modalStack.indexOf(stackId)
      if (idx !== -1) modalStack.splice(idx, 1)
    }
  }, [stackId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === stackId) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, stackId])

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  // Portaled to <body>: a transformed/overflow-hidden ancestor (e.g. a
  // dragged bottom sheet) would otherwise become this fixed dialog's
  // containing block and clip it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-night-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${maxWidths[size]} bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated animate-slide-up flex flex-col focus:outline-none`}
        style={{
          ...sheetStyle,
          ...(isMobile && keyboardInset > 0
            ? {
                maxHeight: `calc(100dvh - env(safe-area-inset-top) - ${keyboardInset}px)`,
                transform: `translateY(-${keyboardInset}px)`,
              }
            : {}),
        }}
      >
        {/* Drag handle (mobile only) — swipe up to expand, down to collapse */}
        <div
          className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          role="slider"
          aria-label={expanded ? 'Drag down to collapse' : 'Drag up to expand'}
          aria-valuemin={0}
          aria-valuemax={1}
          aria-valuenow={expanded ? 1 : 0}
          tabIndex={0}
          {...handleProps}
        >
          <div className={`w-10 h-1 rounded-full transition-colors duration-200 ${expanded ? 'bg-night-900/40' : 'bg-night-900/25'}`} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:py-5 border-b border-night-900/10 flex-shrink-0">
          <h2 id={titleId} className="font-display uppercase tracking-wide text-lg text-night-900 truncate pr-3">{title}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-800 active:bg-cream-200 transition-colors text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content — safe-area bottom inset */}
        <div
          className="overflow-y-auto flex-1 overscroll-contain"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
