import toast from 'react-hot-toast'

interface Props {
  /** Share sheet title (used by navigator.share). */
  title: string
  /** Optional share text, e.g. "Join me at …". */
  text?: string
  /** Absolute URL to share / copy. */
  url: string
  /** Extra classes for the button; sensible ghost styling by default. */
  className?: string
  /** Visible label next to the icon. Hidden on small screens. */
  label?: string
}

/**
 * Reusable share control: native share sheet where available
 * (navigator.share), clipboard copy + toast everywhere else.
 */
export default function ShareButton({ title, text, url, className, label = 'Share' }: Props) {
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch (err) {
        // User dismissed the sheet — not an error, and no fallback wanted.
        if (err instanceof Error && err.name === 'AbortError') return
        // Any other failure falls through to the clipboard path.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={className ?? 'btn-ghost px-2 py-1.5 text-charcoal-500 text-sm flex items-center gap-1'}
      aria-label={`Share ${title}`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
