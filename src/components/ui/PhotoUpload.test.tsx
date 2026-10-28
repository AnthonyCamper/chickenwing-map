import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const toastMock = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toastMock }))

// jsdom can't decode images; decide per file name instead.
vi.mock('../../lib/imageValidation', () => ({
  MAX_IMAGE_MB: 15,
  validateImageFile: vi.fn(async (f: File) =>
    f.name.startsWith('junk') ? `"${f.name}" can't be opened as a photo. It may be damaged. Try a different file.` : null),
}))

import PhotoUpload from './PhotoUpload'

beforeEach(() => {
  toastMock.error.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:x')
  URL.revokeObjectURL = vi.fn()
})

const file = (name: string) => new File(['x'], name, { type: 'image/jpeg' })

describe('PhotoUpload', () => {
  it('rejects files that do not decode as images, with a clear message', async () => {
    const onChange = vi.fn()
    const { container } = render(<PhotoUpload files={[]} onChange={onChange} />)
    const input = container.querySelector('input[type="file"]')!
    fireEvent.change(input, { target: { files: [file('junk.jpg'), file('wings.jpg')] } })

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0].map((f: File) => f.name)).toEqual(['wings.jpg'])
    expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("junk.jpg\" can't be opened as a photo"), expect.anything())
  })

  it('adds nothing when every file is junk', async () => {
    const onChange = vi.fn()
    const { container } = render(<PhotoUpload files={[]} onChange={onChange} />)
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file('junk.jpg')] } })
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows the real size limit', () => {
    render(<PhotoUpload files={[]} onChange={vi.fn()} />)
    expect(screen.getByText(/15 MB each/)).toBeInTheDocument()
  })

  it('says so when more than 5 photos are picked, instead of silently dropping one', async () => {
    const onChange = vi.fn()
    const { container } = render(<PhotoUpload files={[]} onChange={onChange} />)
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map(n => file(`${n}.jpg`))
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: six } })
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0][0]).toHaveLength(5)
    expect(screen.getByText('Only 5 photos per review — the first 5 you picked were added.')).toBeInTheDocument()
  })

  it('shows the limit is reached instead of an active "Add photos" box', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(n => file(`${n}.jpg`))
    const { container } = render(<PhotoUpload files={five} onChange={vi.fn()} />)
    expect(screen.getByText('Photo limit reached')).toBeInTheDocument()
    expect(container.querySelector('input[type="file"]')).toBeDisabled()
  })
})
