import { describe, it, expect, beforeEach } from 'vitest'
import {
  RETURN_TO_MAX_AGE_MS,
  clearReturnTo,
  isSafeReturnPath,
  peekReturnTo,
  rememberReturnTo,
  takeReturnTo,
} from './authReturn'

beforeEach(() => sessionStorage.clear())

describe('auth return-to', () => {
  it('round-trips a page and consumes it', () => {
    rememberReturnTo('/spots/ale-marys')
    expect(takeReturnTo()).toBe('/spots/ale-marys')
    expect(takeReturnTo()).toBeNull()
  })

  it('ignores an entry older than 15 minutes (F15: stale "Start a new list")', () => {
    rememberReturnTo('/lists/new')
    expect(takeReturnTo(Date.now() + RETURN_TO_MAX_AGE_MS + 1000)).toBeNull()
    // and it's gone afterwards
    expect(peekReturnTo()).toBeNull()
  })

  it('never stores an auth page, so a click on /register cannot overwrite the origin', () => {
    rememberReturnTo('/spots/ale-marys')
    rememberReturnTo('/register')
    rememberReturnTo('/login?x=1')
    expect(takeReturnTo()).toBe('/spots/ale-marys')
  })

  it('still honours the bare path CrawlEditor writes', () => {
    sessionStorage.setItem('auth-return-to', '/lists/new')
    expect(takeReturnTo()).toBe('/lists/new')
  })

  it('refuses off-site and auth destinations', () => {
    expect(isSafeReturnPath('//evil.example')).toBe(false)
    expect(isSafeReturnPath('https://evil.example')).toBe(false)
    expect(isSafeReturnPath('/reset-password')).toBe(false)
    expect(isSafeReturnPath('/u/tony')).toBe(true)
    sessionStorage.setItem('auth-return-to', '//evil.example')
    expect(takeReturnTo()).toBeNull()
  })

  it('clearReturnTo forgets it', () => {
    rememberReturnTo('/u/tony')
    clearReturnTo()
    expect(takeReturnTo()).toBeNull()
  })
})
