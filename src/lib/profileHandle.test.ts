import { describe, it, expect } from 'vitest'
import { firstFreeHandle, handleCandidate, handleLookupPrefix, slugifyName, usernameProblem, usernameSaveError, USERNAME_TAKEN_MESSAGE } from './profileHandle'

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

  // Outputs copied from the sandbox DB's set_profile_username() (044).
  it('keeps the whole name, suffix included, within 30 characters', () => {
    const junk = slugifyName("<script>alert(1)</script> Z̷a̸l̵g̶o̷ 🍗 'OR 1=1--")
    expect(firstFreeHandle(junk, [])).toBe('script-alert-1-script-z-a-l-g')
    expect(firstFreeHandle(junk, ['script-alert-1-script-z-a-l-g'])).toBe('script-alert-1-script-z-a-l-2')
    const long = slugifyName('abcdefghijklmnopqrstuvwxyz abcd-efgh')
    expect(firstFreeHandle(long, [])).toBe('abcdefghijklmnopqrstuvwxyz-abc')
    expect(firstFreeHandle(long, ['abcdefghijklmnopqrstuvwxyz-abc'])).toBe('abcdefghijklmnopqrstuvwxyz-a-2')
    expect(firstFreeHandle('abcdefghijklmnopqrstuvwxyzabc-d', ['abcdefghijklmnopqrstuvwxyzabc']))
      .toBe('abcdefghijklmnopqrstuvwxyzab-2')
    for (let n = 1; n < 12000; n += 997) {
      const c = handleCandidate('a'.repeat(40), n)
      expect(c.length).toBeLessThanOrEqual(30)
      expect(usernameProblem(c)).toBeNull()
    }
  })

  it('skips names that are reserved or too short, like the sign-up trigger', () => {
    expect(firstFreeHandle('admin', [])).toBe('admin-2')
    expect(firstFreeHandle('r', [])).toBe('r-2')
    expect(firstFreeHandle('al', ['al-2'])).toBe('al-3')
  })

  it('looks up a prefix that every candidate starts with', () => {
    const long = slugifyName('abcdefghijklmnopqrstuvwxyz abcd-efgh')
    const prefix = handleLookupPrefix(long)
    for (const n of [1, 2, 10, 999, 9999]) expect(handleCandidate(long, n).startsWith(prefix)).toBe(true)
    expect(handleLookupPrefix('sam')).toBe('sam')
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
