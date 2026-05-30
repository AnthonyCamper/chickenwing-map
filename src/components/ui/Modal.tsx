import { useEffect, ReactNode } from 'react'
import { useBottomSheetDrag } from '../../hooks/useBottomSheetDrag'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, onClose, children, size = 'md' }: Props) {
  const { expanded, handleProps, sheetStyle } = useBottomSheetDrag()

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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const maxWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-night-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div
        className={`relative w-full ${maxWidths[size]} bg-cream-50 rounded-t-3xl sm:rounded-3xl sm:border-2 sm:border-night-900 shadow-elevated animate-slide-up flex flex-col`}
        style={sheetStyle}
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
          <h2 className="font-display uppercase tracking-wide text-lg text-night-900 truncate pr-3">{title}</h2>
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
    </div>
  )
}
