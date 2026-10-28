import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  FEED_LANDING_MAX_WAIT_MS,
  _resetFeedLandingForTests,
  isFastConnection,
  isFeedLandingSettled,
  markFeedLandingSettled,
  onFeedLandingSettled,
} from './feedLanding'

describe('feedLanding (S26: the first feed photo goes first)', () => {
  beforeEach(() => _resetFeedLandingForTests())
  afterEach(() => vi.useRealTimers())

  it('runs waiting work once the landing photo is done, and later work straight away', () => {
    const early = vi.fn()
    onFeedLandingSettled(early)
    expect(early).not.toHaveBeenCalled()
    markFeedLandingSettled()
    expect(early).toHaveBeenCalledTimes(1)
    expect(isFeedLandingSettled()).toBe(true)

    const late = vi.fn()
    onFeedLandingSettled(late)
    expect(late).toHaveBeenCalledTimes(1)
    markFeedLandingSettled()
    expect(early).toHaveBeenCalledTimes(1)
  })

  it('never holds work back past the maximum wait', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    onFeedLandingSettled(cb)
    vi.advanceTimersByTime(FEED_LANDING_MAX_WAIT_MS)
    expect(cb).toHaveBeenCalledTimes(1)
    markFeedLandingSettled()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('cancel stops the callback', () => {
    const cb = vi.fn()
    const cancel = onFeedLandingSettled(cb)
    cancel()
    markFeedLandingSettled()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('isFastConnection', () => {
  const nav = navigator as Navigator & { connection?: unknown }
  afterEach(() => { delete nav.connection })

  it('is false on 3G / 2G or with data saver, true otherwise or when unknown', () => {
    expect(isFastConnection()).toBe(true)
    Object.defineProperty(nav, 'connection', { value: { effectiveType: '3g' }, configurable: true })
    expect(isFastConnection()).toBe(false)
    Object.defineProperty(nav, 'connection', { value: { effectiveType: 'slow-2g' }, configurable: true })
    expect(isFastConnection()).toBe(false)
    Object.defineProperty(nav, 'connection', { value: { effectiveType: '4g', saveData: true }, configurable: true })
    expect(isFastConnection()).toBe(false)
    Object.defineProperty(nav, 'connection', { value: { effectiveType: '4g' }, configurable: true })
    expect(isFastConnection()).toBe(true)
  })
})
