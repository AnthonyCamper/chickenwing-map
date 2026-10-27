import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from './Modal'

interface Props {
  /** Share sheet title (used by navigator.share). */
  title: string
  /** Optional share text, e.g. "Join me at …". */
  text?: string
  /** Absolute URL to share / copy. */
  url: string
  /** Extra classes for the button; sensible ghost styling by default. */
  className?: string
  /** Visible label next to the icon. Pass '' for an icon-only button. */
  label?: string
}

/**
 * Reusable share control: native share sheet where available
 * (navigator.share), clipboard copy + toast everywhere else, and — when the
 * clipboard is blocked too — a small dialog with the link selected so the
 * user can still copy it by hand. Never a dead-end "could not copy".
 */
export default function ShareButton({ title, text, url, className, label = 'Share' }: Props) {
  const [manualCopy, setManualCopy] = useState(false)

  const handleShare = async (e: React.MouseEvent) => {
    // Cards wrap this in clickable areas — sharing shouldn't also open them.
    e.stopPropagation()
    e.preventDefault()
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
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(url)
      toast.success('Link copied')
    } catch {
      setManualCopy(true)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={className ?? 'btn-ghost min-w-[44px] px-2 py-1.5 text-charcoal-500 text-sm flex items-center gap-1'}
        aria-label={`Share ${title}`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {label && <span>{label}</span>}
      </button>
      {manualCopy && <ManualCopyDialog url={url} onClose={() => setManualCopy(false)} />}
    </>
  )
}

/** Fallback when neither the share sheet nor the clipboard is available. */
function ManualCopyDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const tryCopy = () => {
    inputRef.current?.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    if (ok) {
      toast.success('Link copied')
      onClose()
    } else {
      toast('The link is selected. Press and hold it, then choose Copy.')
    }
  }

  return (
    <Modal title="Copy this link" onClose={onClose} size="sm">
      <div className="px-6 py-5 space-y-4">
        <p className="text-sm text-charcoal-700">
          Your browser blocked automatic copying. Select the link below and copy it.
        </p>
        <input
          ref={inputRef}
          type="text"
          readOnly
          value={url}
          aria-label="Link to share"
          onFocus={e => e.currentTarget.select()}
          className="input w-full font-mono text-base"
        />
        <div className="flex gap-3 pb-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Close
          </button>
          <button type="button" onClick={tryCopy} className="btn-primary flex-1">
            Copy link
          </button>
        </div>
      </div>
    </Modal>
  )
}
