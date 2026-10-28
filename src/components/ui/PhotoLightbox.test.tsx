import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import PhotoLightbox from './PhotoLightbox'

describe('PhotoLightbox', () => {
  // Runs first: jsdom's history is shared by the tests in this file.
  it('browser Back closes the viewer instead of leaving the page', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const onClose = vi.fn()
    render(<PhotoLightbox photos={[{ id: 'p1', url: 'a.jpg' }]} initialIndex={0} onClose={onClose} />)
    expect(push).toHaveBeenCalledTimes(1)
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(onClose).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })

  it('is a labelled modal dialog with a described photo', () => {
    render(<PhotoLightbox photos={[{ id: 'p1', url: 'a.jpg', alt: 'Photo of wings at Duff' }]} initialIndex={0} onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: 'Photo viewer' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByAltText('Photo of wings at Duff')).toBeInTheDocument()
  })
})
