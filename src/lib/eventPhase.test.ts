import { describe, it, expect } from 'vitest'
import { eventPhase } from './eventPhase'

const EVENT = { starts_at: '2026-08-08T15:00:00-04:00', ends_at: null }

const at = (iso: string) => new Date(iso)

describe('eventPhase', () => {
  it('is announced with no stops before the event', () => {
    expect(eventPhase(EVENT, 0, at('2026-07-29T12:00:00-04:00'))).toBe('announced')
  })

  it('is route_live once stops exist before the event', () => {
    expect(eventPhase(EVENT, 5, at('2026-07-29T12:00:00-04:00'))).toBe('route_live')
  })

  it('flips to crawl_day at the start of the event day, not the start time', () => {
    expect(eventPhase(EVENT, 5, at('2026-08-08T00:00:01-04:00'))).toBe('crawl_day')
    expect(eventPhase(EVENT, 5, at('2026-08-07T23:59:59-04:00'))).toBe('route_live')
  })

  it('is crawl_day on the event day even with zero stops', () => {
    expect(eventPhase(EVENT, 0, at('2026-08-08T12:00:00-04:00'))).toBe('crawl_day')
  })

  it('wraps after the end of the start day when ends_at is null', () => {
    expect(eventPhase(EVENT, 5, at('2026-08-08T23:59:00-04:00'))).toBe('crawl_day')
    expect(eventPhase(EVENT, 5, at('2026-08-09T00:01:00-04:00'))).toBe('wrapped')
  })

  it('honors a multi-day window via ends_at', () => {
    const evt = { starts_at: '2026-08-08T15:00:00-04:00', ends_at: '2026-08-10T02:00:00-04:00' }
    expect(eventPhase(evt, 5, at('2026-08-09T20:00:00-04:00'))).toBe('crawl_day')
    expect(eventPhase(evt, 5, at('2026-08-10T02:00:01-04:00'))).toBe('wrapped')
  })

  it('never reaches crawl_day or wrapped without starts_at', () => {
    const evt = { starts_at: null, ends_at: null }
    expect(eventPhase(evt, 0, at('2026-08-08T12:00:00-04:00'))).toBe('announced')
    expect(eventPhase(evt, 3, at('2026-08-08T12:00:00-04:00'))).toBe('route_live')
  })

  it('degrades gracefully on unparseable dates', () => {
    const evt = { starts_at: 'not-a-date', ends_at: null }
    expect(eventPhase(evt, 0, at('2026-08-08T12:00:00-04:00'))).toBe('announced')
    expect(eventPhase(evt, 2, at('2026-08-08T12:00:00-04:00'))).toBe('route_live')
  })
})
