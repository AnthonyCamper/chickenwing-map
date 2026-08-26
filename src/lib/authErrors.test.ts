import { describe, it, expect } from 'vitest'
import { friendlyAuthError } from './authErrors'

describe('friendlyAuthError', () => {
  it('explains the email send cap instead of leaking the raw 429', () => {
    const msg = friendlyAuthError('email rate limit exceeded')
    expect(msg).not.toMatch(/rate limit/i)
    expect(msg).toMatch(/Google/)
  })

  it('matches the rate-limit error regardless of casing or prefix', () => {
    for (const raw of [
      'Email rate limit exceeded',
      'For security purposes, email rate limit exceeded',
      'over_email_send_rate_limit',
    ]) {
      expect(friendlyAuthError(raw)).toMatch(/Google/)
    }
  })

  it('rewrites the confusing invalid-email error', () => {
    expect(friendlyAuthError('Email address "me@gmail.con" is invalid')).toMatch(/check it for typos/i)
  })

  it('passes other errors through untouched', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Invalid login credentials')
  })

  it('falls back to a generic message when there is no message', () => {
    expect(friendlyAuthError('')).toMatch(/went wrong/i)
  })
})
