import { describe, it, expect } from 'vitest'
import { firstFreeHandle, slugifyName, usernameProblem, usernameSaveError, USERNAME_TAKEN_MESSAGE } from './profileHandle'

describe('slugifyName', () => {
  it('matches the database slugify() (outputs copied from the sandbox DB)', () => {
    const cases: Record<string, string> = {
      'Carlos Ramírez': 'carlos-ramirez',
      'Peña Æsir Œuvre Straße': 'pena-aesir-oeuvre-strasse',
      '  --Sam  Skeptic!! ': 'sam-skeptic',
      '<img src=x onerror=alert(1)>i̇n̈g': 'img-src-x-onerror-alert-1-i-n-g',
      'THUMB WINGS': 'thumb-wings',
      'José_Ñandú 123': 'jose-nandu-123',
      '李小龙': '',
      "Zoë O'Brien": 'zoe-o-brien',
    }
    for (const [input, expected] of Object.entries(cases)) {
      expect(slugifyName(input)).toBe(expected)
    }
  })
})

describe('firstFreeHandle', () => {
  it('adds -2, -3… like the sign-up trigger when the name is taken', () => {
    expect(firstFreeHandle('sam', [])).toBe('sam')
    expect(firstFreeHandle('sam', ['sam'])).toBe('sam-2')
    expect(firstFreeHandle('sam', ['sam', 'sam-2', 'sam-skeptic'])).toBe('sam-3')
  })
})

describe('usernameProblem', () => {
  it('accepts a normal slug', () => {
    expect(usernameProblem('breaker-bob')).toBeNull()
    expect(usernameProblem('tony2')).toBeNull()
  })

  it('explains each broken rule in plain words', () => {
    expect(usernameProblem('')).toMatch(/enter a username/i)
    expect(usernameProblem('Bob')).toMatch(/small letters/i)
    expect(usernameProblem('bob smith')).toMatch(/no spaces/i)
    expect(usernameProblem('bob_smith')).toMatch(/only letters/i)
    expect(usernameProblem('-bob')).toMatch(/start or end/i)
    expect(usernameProblem('bob--smith')).toMatch(/one hyphen/i)
    expect(usernameProblem('ab')).toMatch(/at least 3/i)
    expect(usernameProblem('a'.repeat(31))).toMatch(/at most 30/i)
    expect(usernameProblem('admin')).toMatch(/reserved/i)
  })
})

describe('usernameSaveError', () => {
  it('maps the database errors to plain English, never raw text', () => {
    expect(usernameSaveError({ code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_unique"' }))
      .toBe(USERNAME_TAKEN_MESSAGE)
    expect(usernameSaveError({ code: '23505', message: 'username: taken' })).toBe(USERNAME_TAKEN_MESSAGE)
    expect(usernameSaveError({ code: '23514', message: 'username: reserved' })).toMatch(/reserved/i)
    expect(usernameSaveError({ code: '23514', message: 'username: too many changes' })).toMatch(/3 times in 30 days/)
    expect(usernameSaveError({ code: 'PGRST301', message: 'JWT expired' })).not.toMatch(/JWT/)
  })
})
