import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import Modal from './Modal'

vi.mock('../../hooks/useBottomSheetDrag', () => ({
  useIsMobile: () => false,
  useBottomSheetDrag: () => ({
    expanded: false,
    setExpanded: vi.fn(),
    handleProps: { onTouchStart: vi.fn(), onTouchMove: vi.fn(), onTouchEnd: vi.fn(), onClick: vi.fn() },
    sheetStyle: { maxHeight: '90dvh' },
  }),
}))

beforeEach(() => {
  document.body.style.cssText = ''
})

describe('Modal stacking', () => {
  it('Escape closes only the topmost of two stacked modals', () => {
    const onCloseBottom = vi.fn()
    const onCloseTop = vi.fn()

    render(
      <Modal title="Bottom" onClose={onCloseBottom}>
        bottom content
      </Modal>
    )
    render(
      <Modal title="Top" onClose={onCloseTop}>
        top content
      </Modal>
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseTop).toHaveBeenCalledTimes(1)
    expect(onCloseBottom).not.toHaveBeenCalled()
  })

  it('after the top modal unmounts, Escape reaches the one below', () => {
    const onCloseBottom = vi.fn()
    const onCloseTop = vi.fn()

    render(
      <Modal title="Bottom" onClose={onCloseBottom}>
        bottom content
      </Modal>
    )
    const top = render(
      <Modal title="Top" onClose={onCloseTop}>
        top content
      </Modal>
    )
    top.unmount()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCloseBottom).toHaveBeenCalledTimes(1)
    expect(onCloseTop).not.toHaveBeenCalled()
  })
})
