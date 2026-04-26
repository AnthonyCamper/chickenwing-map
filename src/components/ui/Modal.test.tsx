import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from './Modal'

// Mock the hook so we can test Modal's integration with it
const mockHandleProps = {
  onTouchStart: vi.fn(),
  onTouchMove: vi.fn(),
  onTouchEnd: vi.fn(),
  onClick: vi.fn(),
}

vi.mock('../../hooks/useBottomSheetDrag', () => ({
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: mockHandleProps,
    sheetStyle: { maxHeight: 'calc(90dvh - env(safe-area-inset-top))' },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Reset body styles that Modal manipulates
  document.body.style.overflow = ''
  document.body.style.position = ''
  document.body.style.top = ''
  document.body.style.width = ''
})

describe('Modal', () => {
  it('renders title and children', () => {
    render(
      <Modal title="Test Modal" onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Test Modal')).toBeInTheDocument()
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        Content
      </Modal>
    )
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        Content
      </Modal>
    )
    // The backdrop has animate-fade-in class
    const backdrop = document.querySelector('.animate-fade-in')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose on Escape key', () => {
    const onClose = vi.fn()
    render(
      <Modal title="Test" onClose={onClose}>
        Content
      </Modal>
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll on mount', () => {
    render(
      <Modal title="Test" onClose={vi.fn()}>
        Content
      </Modal>
    )
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.position).toBe('fixed')
    expect(document.body.style.width).toBe('100%')
  })

  it('restores body scroll on unmount', () => {
    const { unmount } = render(
      <Modal title="Test" onClose={vi.fn()}>
        Content
      </Modal>
    )
    unmount()
    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.position).toBe('')
  })

  it('renders drag handle with slider role', () => {
    render(
      <Modal title="Test" onClose={vi.fn()}>
        Content
      </Modal>
    )
    const handle = screen.getByRole('slider')
    expect(handle).toBeInTheDocument()
    expect(handle).toHaveAttribute('aria-label')
  })

  it('renders with correct size class', () => {
    const { container } = render(
      <Modal title="Test" onClose={vi.fn()} size="lg">
        Content
      </Modal>
    )
    const sheet = container.querySelector('.max-w-2xl')
    expect(sheet).toBeInTheDocument()
  })

  it('has touch-none on drag handle for gesture control', () => {
    render(
      <Modal title="Test" onClose={vi.fn()}>
        Content
      </Modal>
    )
    const handle = screen.getByRole('slider')
    expect(handle.className).toContain('touch-none')
  })

  it('content area has overflow-y-auto for scrolling', () => {
    render(
      <Modal title="Test" onClose={vi.fn()}>
        <div data-testid="inner">Content</div>
      </Modal>
    )
    const scrollContainer = screen.getByTestId('inner').parentElement!
    expect(scrollContainer.className).toContain('overflow-y-auto')
  })
})
