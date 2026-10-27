import { parseLocalDate, formatVisitDate, relativeVisitDate, localDateString } from './dates'

describe('dates', () => {
  it('parses YYYY-MM-DD as a local calendar date, not UTC midnight', () => {
    const d = parseLocalDate('2026-10-27')!
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 27])
    expect(formatVisitDate('2026-10-27')).toBe('Oct 27, 2026')
  })
  it('labels today as "today", never hours ago', () => {
    expect(relativeVisitDate(localDateString())).toBe('today')
  })
  it('handles bad input', () => {
    expect(parseLocalDate('nope')).toBeNull()
    expect(formatVisitDate(null)).toBe('')
  })
})
