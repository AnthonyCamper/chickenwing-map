import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ validate: vi.fn(), toastError: vi.fn() }))
vi.mock('../../lib/imageValidation', () => ({ MAX_IMAGE_MB: 15, validateImageFile: mocks.validate }))
vi.mock('react-hot-toast', () => ({ default: { error: mocks.toastError } }))

import CoverImagePicker from './CoverImagePicker'

function pick(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => vi.clearAllMocks())

describe('CoverImagePicker', () => {
  it('shows the specific reason a file was rejected instead of a bare "Upload failed" (r2 breaker 7)', async () => {
    mocks.validate.mockResolvedValue('"evil.txt" isn\'t a photo. Choose a JPG, PNG, WebP or GIF.')
    const onChange = vi.fn()
    const { container } = render(<CoverImagePicker preview={null} onChange={onChange} onClear={vi.fn()} maxBytes={20 * 1024 * 1024} />)
    pick(container, new File(['x'], 'evil.txt', { type: 'text/plain' }))
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringMatching(/isn't a photo/), expect.anything()))
    expect(mocks.validate).toHaveBeenCalledWith(expect.any(File), 20)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('passes a valid photo on', async () => {
    mocks.validate.mockResolvedValue(null)
    const onChange = vi.fn()
    const { container } = render(<CoverImagePicker preview={null} onChange={onChange} onClear={vi.fn()} />)
    const file = new File(['x'], 'cover.jpg', { type: 'image/jpeg' })
    pick(container, file)
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(file))
    expect(mocks.toastError).not.toHaveBeenCalled()
  })
})
