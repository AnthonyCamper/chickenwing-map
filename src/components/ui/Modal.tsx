import { useEffect, useRef, useState, ReactNode, useId } from 'react'
import { createPortal } from 'react-dom'
import { useBottomSheetDrag, useIsMobile } from '../../hooks/useBottomSheetDrag'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useHideFab } from '../../hooks/useHideFab'
import { useKeyboardViewport } from '../../hooks/useKeyboardViewport'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Pinned below the scroll area (e.g. a form's Cancel / Submit row) so the
   *  primary action is always on screen. Submit buttons here reach their
   *  form with the `form="<form id>"` attribute. */
  footer?: ReactNode
}

// Module-level stack of open modals so Escape only dismisses the topmost one
// when modals are nested (e.g. edit modal above a detail sheet).
const modalStack: symbol[] = []

export default function Modal({ title, onClose, children, size = 'md', footer }: Props) {
  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag({ onDismiss: onClose })
  const panelRef = useFocusTrap<HTMLDivElement>()
  const titleId = useId()
  const [stackId] = useState(() => Symbol('modal'))
  const isMobile = useIsMobile()
  const footerRef = useRef<HTMLDivElement>(null)

  // The floating "Rate wings" button would sit on top of the sheet's own
  // footer buttons and text; it steps aside while any modal is open.
  useHideFab(true)

  // Keep the sheet above the iOS keyboard: while a field has focus, pin the
  // overlay to the visible part of the screen so the bottom-anchored sheet
  // sits on top of the keyboard and is never taller than what's left.
  const keyboardBox = useKeyboardViewport(isMobile)

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

  // Toasts sit at the bottom of the screen (App's Toaster); publish the
  // pinned footer's height so they're lifted above Cancel / Publish instead
  // of covering them. Last writer wins, which is the topmost modal.
  const hasFooter = footer != null
  useEffect(() => {
    const el = footerRef.current
    const root = document.documentElement
    if (!el) return
    const set = () => root.style.setProperty('--wkt-sheet-footer', `${el.offsetHeight}px`)
    set()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.removeProperty('--wkt-sheet-footer')
    }
  }, [hasFooter])

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  // Portaled to <body>: a transformed/overflow-hidden ancestor (e.g. a
  // dragged bottom sheet) would otherwise become this fixed dialog's
  // containing block and clip it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={keyboardBox ? { top: keyboardBox.top, height: keyboardBox.height, bottom: 'auto' } : undefined}
    >
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
          ...(keyboardBox ? { maxHeight: 'calc(100% - env(safe-area-inset-top))' } : {}),
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
            className="w-11 h-11 -mr-1.5 rounded-full flex items-center justify-center text-charcoal-500 hover:bg-cream-100 hover:text-night-800 active:bg-cream-200 transition-colors text-2xl leading-none flex-shrink-0"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content — safe-area bottom inset. overflow-x hidden:
            overflow-y:auto alone makes x auto too, so anything a hair too
            wide let the whole sheet slide left and right on iPhone. */}
        <div
          className="overflow-y-auto overflow-x-hidden flex-1 min-w-0 overscroll-contain"
          style={footer ? undefined : { paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>

        {footer && (
          <div
            ref={footerRef}
            className="flex-shrink-0 border-t border-night-900/10 bg-cream-50 px-6 pt-3 pb-3 rounded-b-none sm:rounded-b-3xl"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
