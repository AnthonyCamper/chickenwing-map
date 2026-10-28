import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHistoryModal } from './useHistoryModal'

describe('useHistoryModal', () => {
  it('browser Back closes the modal', () => {
    const onClose = vi.fn()
    renderHook(() => useHistoryModal(true, onClose))
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('canClose returning false keeps it open and re-pushes the entry', () => {
    const onClose = vi.fn()
    const push = vi.spyOn(window.history, 'pushState')
    renderHook(() => useHistoryModal(true, onClose, () => false))
    const pushesBefore = push.mock.calls.length
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(onClose).not.toHaveBeenCalled()
    expect(push.mock.calls.length).toBe(pushesBefore + 1)
    push.mockRestore()
  })
})
