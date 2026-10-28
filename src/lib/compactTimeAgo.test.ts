import { describe, it, expect } from 'vitest'
import { compactTimeAgo, fullDateTime } from './compactTimeAgo'

const now = new Date(2026, 9, 28, 15, 0, 0)
const ago = (sec: number) => new Date(now.getTime() - sec * 1000)

describe('compactTimeAgo', () => {
  it('uses now / minutes / hours / days', () => {
    expect(compactTimeAgo(ago(5), now)).toBe('now')
    expect(compactTimeAgo(ago(5 * 60), now)).toBe('5 min')
    expect(compactTimeAgo(ago(3 * 3600), now)).toBe('3 hr')
    expect(compactTimeAgo(ago(2 * 86400), now)).toBe('2 days')
    expect(compactTimeAgo(ago(86400), now)).toBe('1 day')
  })

  it('switches to a short date after a week', () => {
    expect(compactTimeAgo(new Date(2026, 9, 3, 12), now)).toBe('Oct 3')
    expect(compactTimeAgo(new Date(2025, 11, 31, 12), now)).toBe('Dec 31, 2025')
  })

  it('treats clock skew (future) as now and bad input as empty', () => {
    expect(compactTimeAgo(ago(-30), now)).toBe('now')
    expect(compactTimeAgo('not a date', now)).toBe('')
  })

  it('has a full date for the title', () => {
    expect(fullDateTime(new Date(2026, 9, 3, 16, 5))).toBe('October 3, 2026 at 4:05 PM')
  })
})
