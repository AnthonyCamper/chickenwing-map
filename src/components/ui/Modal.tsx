import { useEffect, ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ title, onClose, children, size = 'md' }: Props) {
  // Lock body scroll while modal is open (prevents double-scroll on iOS)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // Also prevent body from moving on iOS
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = prev
      document.body.style.position = ''
      document.body.style.width = ''
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
        className="absolute inset-0 bg-charcoal-900/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet — slides up from bottom on mobile, centered on desktop */}
      <div
        className={`relative w-full ${maxWidths[size]} bg-white rounded-t-3xl sm:rounded-3xl shadow-elevated animate-slide-up flex flex-col`}
        style={{ maxHeight: 'calc(90dvh - env(safe-area-inset-top))' }}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-warmgray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sm:py-5 border-b border-warmgray-100 flex-shrink-0">
          <h2 className="font-display text-lg text-charcoal-800">{title}</h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center text-charcoal-400 hover:bg-warmgray-100 hover:text-charcoal-600 active:bg-warmgray-200 transition-colors text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto flex-1"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
