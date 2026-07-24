import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

interface Props {
  mode: 'view' | 'edit'
  viewHref: string
  editHref: string
  onDelete?: () => void | Promise<void>
}

/**
 * Sticky toolbar for crawl owners. Pill switcher between View and Edit,
 * plus a Delete affordance with inline confirm. Renders on both
 * CrawlPage (mode="view") and CrawlEditor (mode="edit") so the owner
 * can flip between them with one tap.
 */
export default function CrawlOwnerToolbar({ mode, viewHref, editHref, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const deleteTriggerRef = useRef<HTMLButtonElement>(null)

  async function handleDelete() {
    if (!onDelete) return
    setBusy(true)
    try {
      await onDelete()
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <div
      // Sticks *below* the sticky AppHeader (58px tall + safe-area) — top-0
      // would pin it underneath the z-40 header, hiding it once you scroll.
      className="sticky z-30 border-b-2 border-night-900/10 bg-cream-100/95 backdrop-blur supports-[backdrop-filter]:bg-cream-100/80"
      style={{ top: 'calc(env(safe-area-inset-top) + 58px)' }}
    >
      <div className="max-w-3xl mx-auto px-5 py-2 flex items-center gap-3">
        {/* View / Edit pill switcher */}
        <div className="flex p-0.5 bg-warmgray-100 rounded-xl border border-night-900/10">
          <PillLink href={viewHref} active={mode === 'view'} label="View" />
          <PillLink href={editHref} active={mode === 'edit'} label="Edit" />
        </div>

        {/* Delete — inline confirm to avoid the system dialog */}
        {onDelete && (
          <div className="ml-auto">
            {confirming ? (
              <span className="inline-flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-500">Delete?</span>
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="btn-danger px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? 'Deleting…' : 'Yes'}
                </button>
                <button
                  onClick={() => { setConfirming(false); deleteTriggerRef.current?.focus() }}
                  className="btn-ghost text-xs text-charcoal-500"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <button
                ref={deleteTriggerRef}
                onClick={() => setConfirming(true)}
                className="min-h-[44px] -my-2 px-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-sauce-600 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PillLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  const cls = active
    ? 'bg-night-900 text-cream-50 shadow-sticker-sm'
    : 'text-charcoal-500 hover:text-night-900'
  return (
    <Link
      to={href}
      className={`min-w-[64px] min-h-[40px] flex items-center justify-center px-4 text-xs font-extrabold uppercase tracking-crowd rounded-lg transition-colors ${cls}`}
      aria-current={active ? 'page' : undefined}
    >
      {label}
    </Link>
  )
}
