import { Suspense, useState, type ComponentProps, type ComponentType } from 'react'
import { lazyWithReload } from '../lib/staleDeploy'
import Modal from './ui/Modal'
import type ReviewFormModalType from './ReviewFormModal'

// The review form (with its spot search, photo upload and pickers) is only
// needed after a tap on "Rate wings", so it stays out of the first download
// (S26). Home warms it once the page is idle; a tap before that shows a
// "Loading the form…" sheet until the code arrives. Drafts are kept by the
// form itself (sessionStorage), so nothing changes there.
type Props = ComponentProps<typeof ReviewFormModalType>

let loaded: ComponentType<Props> | null = null
const loadForm = () => import('./ReviewFormModal').then(m => {
  loaded = m.default
  return m
})
const LazyForm = lazyWithReload(loadForm)

/** Warm the form's code (e.g. when the page is idle). */
export const prefetchReviewFormModal = loadForm

export default function LazyReviewFormModal(props: Props) {
  // Decided once per opening: switching from the lazy wrapper to the loaded
  // component mid-way would remount the form and lose what was typed.
  const [Ready] = useState(() => loaded)
  if (Ready) return <Ready {...props} />
  return (
    <Suspense fallback={<FormLoading {...props} />}>
      <LazyForm {...props} />
    </Suspense>
  )
}

function FormLoading({ onClose, eventContext }: Props) {
  return (
    <Modal title={eventContext ? `Review for ${eventContext.event_name}` : 'Add a review'} onClose={onClose}>
      <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-charcoal-600">
        <span aria-hidden="true" className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
        Loading the form…
      </div>
    </Modal>
  )
}
