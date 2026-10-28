import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { isChunkLoadError, reloadOnceForNewVersion, _resetStaleDeployForTests } from './staleDeploy'

describe('isChunkLoadError', () => {
  it('recognises failed chunk downloads in each browser', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/A-1.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/assets/A-1.js'))).toBe(true)
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/A-1.css'))).toBe(true)
  })

  it('ignores ordinary errors', () => {
    expect(isChunkLoadError(new Error('boom'))).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })
})

describe('reloadOnceForNewVersion', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    sessionStorage.clear()
    _resetStaleDeployForTests()
    reload.mockReset()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    vi.useRealTimers()
  })

  it('reloads once, then reports the reload as under way without reloading again', () => {
    expect(reloadOnceForNewVersion()).toBe(true)
    expect(reloadOnceForNewVersion()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does not reload again right after a reload (no loop on the new page)', () => {
    expect(reloadOnceForNewVersion()).toBe(true)
    _resetStaleDeployForTests() // simulate the freshly reloaded page
    expect(reloadOnceForNewVersion()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('allows another automatic reload after the cooldown', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
    expect(reloadOnceForNewVersion()).toBe(true)
    _resetStaleDeployForTests()
    vi.setSystemTime(new Date('2026-10-28T12:05:00Z'))
    expect(reloadOnceForNewVersion()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not reload while offline', () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      expect(reloadOnceForNewVersion()).toBe(false)
      expect(reload).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
