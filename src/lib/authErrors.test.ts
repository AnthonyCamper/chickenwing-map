import { describe, it, expect } from 'vitest'
import { friendlyAuthError, isSchemaDriftError } from './authErrors'

describe('isSchemaDriftError', () => {
  it('flags the revoked-grant error that broke posting for everyone', () => {
    // What profiles?select=...,email returned after email was column-revoked.
    expect(isSchemaDriftError({ code: '42501' })).toBe(true)
  })

  it('flags a client asking for a column the schema no longer has', () => {
    expect(isSchemaDriftError({ code: '42703' })).toBe(true)
    expect(isSchemaDriftError({ code: 'PGRST204' })).toBe(true)
  })

  it('does not flag transient failures, which should stay silent', () => {
    expect(isSchemaDriftError({ code: 'PGRST301' })).toBe(false)
    expect(isSchemaDriftError({ code: '57014' })).toBe(false)
  })

  it('handles a missing or codeless error without throwing', () => {
    expect(isSchemaDriftError(null)).toBe(false)
    expect(isSchemaDriftError(undefined)).toBe(false)
    expect(isSchemaDriftError({})).toBe(false)
    expect(isSchemaDriftError({ code: null })).toBe(false)
  })
})

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
