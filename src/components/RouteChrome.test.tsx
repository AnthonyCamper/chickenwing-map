import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { Helmet, HelmetProvider } from 'react-helmet-async'
import { DEFAULT_TITLE, DefaultTitle, ScrollToTop } from './RouteChrome'

let nav: ReturnType<typeof useNavigate>
function CaptureNavigate() {
  nav = useNavigate()
  return null
}

function TitledPage() {
  return (
    <>
      <Helmet><title>Create account — WingKingTony</title></Helmet>
      <p>register page</p>
    </>
  )
}

function renderApp(initial = '/register') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initial]}>
        <CaptureNavigate />
        <DefaultTitle />
        <ScrollToTop />
        <Routes>
          <Route path="/register" element={<TitledPage />} />
          <Route path="/" element={<p>home feed</p>} />
          <Route path="/spots/:slug" element={<p>spot page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  )
}

beforeEach(() => {
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
})

describe('DefaultTitle', () => {
  it('resets the tab title when leaving a titled page for one without a title (F02)', async () => {
    renderApp('/register')
    await waitFor(() => expect(document.title).toBe('Create account — WingKingTony'))

    act(() => nav('/'))
    expect(await screen.findByText('home feed')).toBeInTheDocument()
    await waitFor(() => expect(document.title).toBe(DEFAULT_TITLE))
  })
})

describe('ScrollToTop', () => {
  it('scrolls to the top on a normal navigation to a new page (F11)', async () => {
    renderApp('/')
    expect(window.scrollTo).not.toHaveBeenCalled() // first load: leave it to the browser
    act(() => nav('/register'))
    await screen.findByText('register page')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })

  it('leaves Back/Forward (POP) alone so the feed can restore its own position', async () => {
    renderApp('/')
    act(() => nav('/spots/x'))
    await screen.findByText('spot page')
    vi.mocked(window.scrollTo).mockClear()
    act(() => nav(-1))
    await screen.findByText('home feed')
    expect(window.scrollTo).not.toHaveBeenCalled()
  })

  it('does not scroll on query-only changes (tabs)', async () => {
    renderApp('/')
    act(() => nav('/?tab=people'))
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
