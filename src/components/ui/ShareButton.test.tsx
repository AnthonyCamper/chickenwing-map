import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import toast from 'react-hot-toast'
import ShareButton from './ShareButton'

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const PROPS = {
  title: 'Wing Crawl',
  text: 'Join me!',
  url: 'https://example.com/lists/wing-crawl',
}

function setNavigatorProp(key: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(window.navigator, key, { value, configurable: true })
}

afterEach(() => {
  vi.clearAllMocks()
  // Remove any stubs we installed on the shared navigator.
  setNavigatorProp('share', undefined)
  setNavigatorProp('clipboard', undefined)
})

describe('ShareButton', () => {
  it('uses navigator.share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNavigatorProp('share', share)

    render(<ShareButton {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share Wing Crawl' }))

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: PROPS.title,
        text: PROPS.text,
        url: PROPS.url,
      })
    })
  })

  it('stays silent when the user dismisses the share sheet', async () => {
    const abort = new Error('cancelled')
    abort.name = 'AbortError'
    const share = vi.fn().mockRejectedValue(abort)
    const writeText = vi.fn().mockResolvedValue(undefined)
    setNavigatorProp('share', share)
    setNavigatorProp('clipboard', { writeText })

    render(<ShareButton {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share Wing Crawl' }))

    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(writeText).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('falls back to clipboard copy with a toast when share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setNavigatorProp('clipboard', { writeText })

    render(<ShareButton {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share Wing Crawl' }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(PROPS.url)
      expect(toast.success).toHaveBeenCalledWith('Link copied!')
    })
  })

  it('shows an error toast when the clipboard copy fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    setNavigatorProp('clipboard', { writeText })

    render(<ShareButton {...PROPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Share Wing Crawl' }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not copy link')
    })
  })
})
