import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'
import { localDateString } from '../lib/dates'

const db = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; name: string; address: string; lat: number; lng: number }>,
}))

vi.mock('../lib/supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'abortSignal', 'ilike']) b[m] = () => b
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: db.rows, error: null }).then(resolve, reject)
    return b
  }
  return { supabase: { from: () => builder() } }
})

vi.mock('../hooks/useBottomSheetDrag', () => ({
  useIsMobile: () => false,
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: { onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn(), onClick: vi.fn() },
    sheetStyle: { maxHeight: '90dvh' },
  }),
}))

const toastMock = vi.hoisted(() => {
  const fn = vi.fn() as unknown as ((...a: unknown[]) => void) & { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  fn.success = vi.fn()
  fn.error = vi.fn()
  return fn
})
vi.mock('react-hot-toast', () => ({ default: toastMock }))

import ReviewFormModal from './ReviewFormModal'
import { BADGES_UNLOCKED_EVENT, announceNewBadges } from '../lib/badgeUnlocks'
import type { ReviewFormData } from '../lib/types'

const fetchMock = vi.fn()

beforeEach(() => {
  sessionStorage.clear()
  db.rows = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ json: async () => [] })
  vi.stubGlobal('fetch', fetchMock)
  toastMock.success.mockReset()
  toastMock.error.mockReset()
  ;(toastMock as unknown as ReturnType<typeof vi.fn>).mockReset()
  document.body.style.cssText = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function ReviewPage() {
  const { id } = useParams()
  return <p>Review page {id}</p>
}

type SubmitFn = (data: ReviewFormData) => Promise<{ error: string | null; reviewId?: string }>

function renderForm(props: Partial<React.ComponentProps<typeof ReviewFormModal>> = {}) {
  const onSubmit = (props.onSubmit ?? vi.fn<SubmitFn>(async () => ({ error: null, reviewId: 'rev-123' }))) as ReturnType<typeof vi.fn<SubmitFn>>
  const onClose = props.onClose ?? vi.fn()
  const utils = render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ReviewFormModal onClose={onClose} {...props} onSubmit={onSubmit} />} />
        <Route path="/reviews/:id" element={<ReviewPage />} />
        <Route path="/login" element={<p>Login page</p>} />
      </Routes>
    </MemoryRouter>
  )
  return { ...utils, onSubmit, onClose }
}

const address = () => screen.getByLabelText('Address') as HTMLInputElement

describe('ReviewFormModal — step 1 location', () => {
  it('uses plain titles and hides raw coordinates behind a link', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'Add a review' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Latitude')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('-37.8136')
    fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }))
    expect(screen.getByLabelText('Latitude')).toHaveAttribute('placeholder', '-90 to 90')
    expect(screen.getByLabelText('Longitude')).toHaveAttribute('placeholder', '-180 to 180')
  })

  it('typing in Address never collapses the field (including spaces only)', () => {
    renderForm()
    fireEvent.change(address(), { target: { value: 'A' } })
    expect(address().value).toBe('A')
    fireEvent.change(address(), { target: { value: 'Av' } })
    expect(address().value).toBe('Av')
    fireEvent.change(address(), { target: { value: '   ' } })
    expect(address()).toBeInTheDocument()
    expect(screen.queryByText('Location set')).not.toBeInTheDocument()
  })

  it('"Find" with no match shows a message under the Address field', async () => {
    renderForm()
    fireEvent.change(address(), { target: { value: 'Calle Inventada 99999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    const msg = await screen.findByText(/We couldn't find that address/)
    expect(document.getElementById('address-help')!.contains(msg)).toBe(true)
    expect(address()).toBeInTheDocument()
  })

  it('"Find" with a match collapses to a summary with "Location set"', async () => {
    fetchMock.mockResolvedValue({ json: async () => [{ lat: '39.29', lon: '-76.61' }] })
    renderForm()
    fireEvent.change(address(), { target: { value: '1939 Fleet St, Baltimore' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText(/Location set/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Address')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Change address' }))
    expect(address().value).toBe('1939 Fleet St, Baltimore')
  })

  it('does not claim "Location set" for impossible coordinates and explains the range', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'X' } })
    fireEvent.change(address(), { target: { value: 'Somewhere' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter coordinates manually' }))
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '99999' } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-99999' } })
    expect(screen.queryByText('Location set')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByText('Latitude must be a number from -90 to 90.')).toBeInTheDocument()
    expect(screen.getByText('Longitude must be a number from -180 to 180.')).toBeInTheDocument()
  })

  it('shows the missing-location error under the Address field', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Wings' } })
    fireEvent.change(address(), { target: { value: '1 Main St' } })
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    const msg = screen.getByText(/We need the location/)
    expect(document.getElementById('address-help')!.contains(msg)).toBe(true)
  })

  it('caps the spot name length', () => {
    renderForm()
    expect(screen.getByLabelText('Wing spot name')).toHaveAttribute('maxLength', '120')
  })
})

async function pickExistingSpot() {
  db.rows = [{ id: 's1', name: 'Ale Marys', address: '1939 Fleet St, Baltimore, MD 21231', lat: 39.2847, lng: -76.5935 }]
  fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Ale Marys' } })
  const option = await screen.findByRole('option', { name: /Ale Marys/ })
  fireEvent.mouseDown(option)
}

describe('ReviewFormModal — existing spots and publishing', () => {
  it('picking a WingMap spot reuses its exact name/address and opens the new review', async () => {
    const { onSubmit } = renderForm()
    await pickExistingSpot()
    expect(screen.getByText(/Already on WingKingTony/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))

    const publish = screen.getByRole('button', { name: 'Publish review' })
    expect(publish).toBeDisabled()
    expect(screen.getByText('Choose a rating to publish your review.')).toBeInTheDocument()
    for (let i = 0; i < 8; i++) fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(publish)

    await screen.findByText('Review page rev-123')
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      shop_name: 'Ale Marys',
      address: '1939 Fleet St, Baltimore, MD 21231',
      lat: '39.2847',
      lng: '-76.5935',
      overall_rating: 8,
    }))
    expect(toastMock.success).toHaveBeenCalledWith('Review published! 🍗', expect.anything())
    expect(sessionStorage.length).toBe(0)
  })

  it('waits for the history-backed modal to pop before navigating', async () => {
    window.history.replaceState({ _modal: true }, '')
    try {
      renderForm()
      await pickExistingSpot()
      fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
      fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
      await waitFor(() => expect(toastMock.success).toHaveBeenCalled())
      expect(screen.queryByText('Review page rev-123')).not.toBeInTheDocument()
      // The sheet is already off screen while the navigation waits (r3 mobile 3).
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
      expect(await screen.findByText('Review page rev-123')).toBeInTheDocument()
    } finally {
      window.history.replaceState(null, '')
    }
  })

  it('stays put with a visible confirmation in an event check-in', async () => {
    const { onSubmit } = renderForm({
      prefill: { shop_name: 'The Brig', address: '39 Clarence St', lat: 45.4, lng: -75.7 },
      eventContext: { event_id: 'e1', event_stop_id: 'st1', event_name: 'Ottawa Crawl' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Review published for Ottawa Crawl. 🍗', expect.anything()))
    expect(screen.queryByText(/Review page/)).not.toBeInTheDocument()
  })

  it('shows a plain error and keeps the form when publishing fails', async () => {
    const onSubmit = vi.fn<SubmitFn>(async () => ({ error: 'new row violates row-level security policy' }))
    renderForm({ onSubmit, prefill: { shop_name: 'X', address: 'Y', lat: 1, lng: 1 } })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith("Couldn't publish your review. Check your connection and try again."))
    expect(screen.getByRole('button', { name: 'Publish review' })).toBeInTheDocument()
  })

  it('limits the visit date to 2000-01-01 … today', () => {
    renderForm({ prefill: { shop_name: 'X', address: 'Y', lat: 1, lng: 1 } })
    const date = screen.getByLabelText('Date you visited')
    expect(date).toHaveAttribute('min', '2000-01-01')
    expect(date).toHaveAttribute('max', localDateString())
    expect(date).toHaveValue(localDateString())
  })

  it('the Back link in step 2 is a 44px tap target', async () => {
    renderForm()
    await pickExistingSpot()
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByRole('button', { name: '← Back' }).className).toContain('min-h-[44px]')
  })
})

describe('ReviewFormModal — drafts', () => {
  it('keeps the draft when closed without discarding (e.g. browser Back) and restores it', async () => {
    const first = renderForm()
    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Half-typed Wings' } })
    fireEvent.change(address(), { target: { value: '12 Main St' } })
    first.unmount() // what browser Back does via useHistoryModal

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.stringMatching(/saved as a draft/), expect.anything()))

    renderForm()
    expect(screen.getByText(/Draft restored/)).toBeInTheDocument()
    expect(screen.getByLabelText('Wing spot name')).toHaveValue('Half-typed Wings')
    expect(address().value).toBe('12 Main St')

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(screen.getByLabelText('Wing spot name')).toHaveValue('')
    expect(screen.queryByText(/Draft restored/)).not.toBeInTheDocument()
    expect(sessionStorage.length).toBe(0)
  })

  it('no "saved as a draft" toast when the parent closes the modal mid-publish (SpotPage)', async () => {
    // SpotPage unmounts the modal as soon as the save succeeds, before its
    // onSubmit resolves (it refetches the page first).
    let finish: (v: { error: null; reviewId: string }) => void = () => {}
    const onSubmit = vi.fn<SubmitFn>(() => new Promise(res => { finish = res }))
    const r = renderForm({ onSubmit, prefill: { shop_name: 'Ale Marys', address: '1939 Fleet St', lat: 39.28, lng: -76.59 } })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    r.unmount()
    await act(async () => { await new Promise(res => setTimeout(res, 10)) })
    await act(async () => { finish({ error: null, reviewId: 'rev-9' }) })
    expect(toastMock).not.toHaveBeenCalledWith(expect.stringMatching(/saved as a draft/), expect.anything())
  })

  it('restores step 2 input for a spot review', () => {
    const prefill = { shop_name: 'Ale Marys', address: '1939 Fleet St', lat: 39.28, lng: -76.59 }
    const first = renderForm({ prefill })
    fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: 'Crispy!' } })
    first.unmount()
    renderForm({ prefill })
    expect(screen.getByLabelText('Your review (optional)')).toHaveValue('Crispy!')
  })

  it('does not leak a draft to another spot', () => {
    const first = renderForm({ prefill: { shop_name: 'A', address: 'a', lat: 1, lng: 1 } })
    fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: 'For A' } })
    first.unmount()
    renderForm({ prefill: { shop_name: 'B', address: 'b', lat: 1, lng: 1 } })
    expect(screen.getByLabelText('Your review (optional)')).toHaveValue('')
  })

  it('confirmed Cancel discards the draft', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Wings' } })
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
    expect(sessionStorage.length).toBe(0)
    confirmSpy.mockRestore()
  })

  it('warns before unload while there is unsaved input', () => {
    renderForm()
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Wings' } })
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })
})

const PREFILL = { shop_name: 'Ale Marys', address: '1939 Fleet St', lat: 39.28, lng: -76.59 }

describe('ReviewFormModal — validation stays visible (m1)', () => {
  it('clears old step-1 errors as soon as the user starts typing a spot name', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByText('Enter the address.')).toBeInTheDocument()
    expect(screen.getByText(/Check the spot name, the address and the location above/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Wing spot name'), { target: { value: 'Kong Poc' } })
    expect(screen.queryByText('Enter the address.')).not.toBeInTheDocument()
    expect(screen.queryByText(/We need the location/)).not.toBeInTheDocument()
    expect(screen.queryByText('Enter the name of the wing spot.')).not.toBeInTheDocument()
  })

  it('flags a future visit date right away, and Publish focuses it with a summary by the button', async () => {
    const { onSubmit } = renderForm({ prefill: PREFILL })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    const date = screen.getByLabelText('Date you visited')
    fireEvent.change(date, { target: { value: '2099-12-31' } })
    expect(screen.getByText(/can't be in the future/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Check the visit date above.')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(date))

    fireEvent.change(date, { target: { value: localDateString() } })
    expect(screen.queryByText(/can't be in the future/)).not.toBeInTheDocument()
    expect(screen.queryByText('Check the visit date above.')).not.toBeInTheDocument()
  })

  it('does not flag a year that is still being typed', () => {
    renderForm({ prefill: PREFILL })
    fireEvent.change(screen.getByLabelText('Date you visited'), { target: { value: '0020-12-31' } })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('never silently cuts pasted review text: counter, error and focus instead', async () => {
    const { onSubmit } = renderForm({ prefill: PREFILL })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    const text = screen.getByLabelText('Your review (optional)')
    expect(text).not.toHaveAttribute('maxLength')
    fireEvent.change(text, { target: { value: 'x'.repeat(620) } })
    expect(text).toHaveValue('x'.repeat(620))
    expect(screen.getByText(/620 \/ 500/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText(/120 characters too long/)).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(text))
  })

  it('says the review will be public, next to Publish', () => {
    renderForm({ prefill: PREFILL })
    expect(screen.getByText('Your review and photos will be public.')).toBeInTheDocument()
  })
})

describe('ReviewFormModal — publishing (m1)', () => {
  it('signed out mid-flow: says so, offers Sign in, and keeps the draft', async () => {
    const onSubmit = vi.fn<SubmitFn>(async () => ({ error: 'signed-out' }))
    renderForm({ onSubmit, prefill: PREFILL })
    fireEvent.change(screen.getByLabelText('Your review (optional)'), { target: { value: 'Crispy!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    expect(await screen.findByText(/You've been signed out. Sign in again to publish — your review is saved./)).toBeInTheDocument()
    expect(toastMock.error).not.toHaveBeenCalled()
    expect(sessionStorage.length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('treats a raw JWT / 401 error as signed out, not a connection problem', async () => {
    const onSubmit = vi.fn<SubmitFn>(async () => ({ error: 'JWT expired' }))
    renderForm({ onSubmit, prefill: PREFILL })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(toastMock.error).not.toHaveBeenCalled()
  })

  it('Cancel and Close do nothing while publishing', async () => {
    let finish: (v: { error: null; reviewId: string }) => void = () => {}
    const onSubmit = vi.fn<SubmitFn>(() => new Promise(res => { finish = res }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { onClose } = renderForm({ onSubmit, prefill: PREFILL })
    fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
    fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
    expect(await screen.findByRole('button', { name: 'Publishing…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { finish({ error: null, reviewId: 'rev-1' }) })
    confirmSpy.mockRestore()
  })

  it('shows badge unlocks only after the published confirmation, tagged as such', async () => {
    db.rows = [{ id: 'b1', name: 'First Wing', earned: true } as unknown as typeof db.rows[number]]
    const seen: Array<{ reviewPublished?: boolean }> = []
    const listener = (e: Event) => seen.push((e as CustomEvent).detail)
    window.addEventListener(BADGES_UNLOCKED_EVENT, listener)
    try {
      // The submit path diffs badges like createReview does.
      const onSubmit = vi.fn<SubmitFn>(async () => {
        await announceNewBadges(new Set())
        return { error: null, reviewId: 'rev-7' }
      })
      renderForm({ onSubmit, prefill: PREFILL })
      fireEvent.click(screen.getByRole('button', { name: 'Increase by 1' }))
      fireEvent.click(screen.getByRole('button', { name: 'Publish review' }))
      await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('Review published! 🍗', expect.anything()))
      expect(seen).toHaveLength(0)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await waitFor(() => expect(seen).toHaveLength(1), { timeout: 2500 })
      expect(seen[0].reviewPublished).toBe(true)
    } finally {
      window.removeEventListener(BADGES_UNLOCKED_EVENT, listener)
    }
  })
})

