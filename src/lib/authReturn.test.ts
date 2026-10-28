import { describe, it, expect, beforeEach } from 'vitest'
import {
  RETURN_TO_MAX_AGE_MS,
  clearReturnTo,
  dropReturnToOnFreshAuthLoad,
  isFreshAuthPageLoad,
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

describe('return-to only applies inside the flow that set it (S09)', () => {
  it('a fresh page load of /login or /register forgets an earlier entry', () => {
    rememberReturnTo('/lists/new')
    dropReturnToOnFreshAuthLoad('/register', 'navigate')
    expect(takeReturnTo()).toBeNull()

    rememberReturnTo('/lists/new')
    dropReturnToOnFreshAuthLoad('/login', 'navigate')
    expect(peekReturnTo()).toBeNull()
  })

  it('a reload or Back/Forward onto the auth page keeps it', () => {
    rememberReturnTo('/lists/new')
    dropReturnToOnFreshAuthLoad('/login', 'reload')
    dropReturnToOnFreshAuthLoad('/login', 'back_forward')
    expect(peekReturnTo()).toBe('/lists/new')
  })

  it('landing on a normal page (e.g. "/" after Google sign-in) keeps it', () => {
    rememberReturnTo('/spots/ale-marys')
    dropReturnToOnFreshAuthLoad('/', 'navigate')
    expect(takeReturnTo()).toBe('/spots/ale-marys')
  })

  it('isFreshAuthPageLoad', () => {
    expect(isFreshAuthPageLoad('/register', 'navigate')).toBe(true)
    expect(isFreshAuthPageLoad('/login', undefined)).toBe(false)
    expect(isFreshAuthPageLoad('/lists/new', 'navigate')).toBe(false)
  })
})
