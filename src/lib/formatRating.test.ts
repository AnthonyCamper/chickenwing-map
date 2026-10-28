import { describe, it, expect } from 'vitest'
import { formatRating } from './formatRating'

describe('formatRating', () => {
  it('rounds halves up', () => {
    expect(formatRating((7.1 + 7.0) / 2)).toBe('7.1')
    expect(formatRating(8.25)).toBe('8.3')
    expect(formatRating(1.005)).toBe('1.0')
  })

  it('keeps one decimal place', () => {
    expect(formatRating(8)).toBe('8.0')
    expect(formatRating('9.94')).toBe('9.9')
  })

  it('falls back for missing values', () => {
    expect(formatRating(null)).toBe('—')
    expect(formatRating(undefined, 'n/a')).toBe('n/a')
    expect(formatRating('abc')).toBe('—')
  })
})
