import { describe, it, expect } from 'vitest'
import { badgeRarity } from './badgeRarity'

describe('badgeRarity', () => {
  it('returns null when stats are missing', () => {
    expect(badgeRarity(null, 34)).toBeNull()
    expect(badgeRarity(3, null)).toBeNull()
    expect(badgeRarity(undefined, undefined)).toBeNull()
    expect(badgeRarity(3, 0)).toBeNull()
  })

  it('treats 0 or 1 earners as one-of-a-kind', () => {
    expect(badgeRarity(0, 34)?.tier).toBe('first')
    expect(badgeRarity(1, 34)?.tier).toBe('first')
  })

  it('tiers by share of members', () => {
    expect(badgeRarity(3, 34)?.tier).toBe('legendary')   // ~9%
    expect(badgeRarity(8, 34)?.tier).toBe('rare')        // ~24%
    expect(badgeRarity(17, 34)?.tier).toBe('uncommon')   // 50%
    expect(badgeRarity(30, 34)?.tier).toBe('common')     // ~88%
  })

  it('reports a whole percent, never rounding a nonzero count to 0%', () => {
    expect(badgeRarity(1, 500)?.pct).toBe(1)
    expect(badgeRarity(0, 34)?.pct).toBe(0)
    expect(badgeRarity(17, 34)?.pct).toBe(50)
  })

  it('caps pct at 100 even if counts exceed members', () => {
    expect(badgeRarity(40, 34)?.pct).toBe(100)
  })
})
