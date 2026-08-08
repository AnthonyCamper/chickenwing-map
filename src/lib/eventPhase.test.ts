import { describe, it, expect } from 'vitest'
import { eventPhase } from './eventPhase'

// Server-resolved window instants, as events_with_counts now supplies them:
// midnight to 23:59:59 on the event's own local day (Eastern here).
const EVENT = {
  starts_at: '2026-08-08T15:00:00-04:00',
  ends_at: null,
  window_opens_at: '2026-08-08T04:00:00Z',
  window_closes_at: '2026-08-09T03:59:59Z',
}

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

  describe('window_opens_at from the server', () => {
    // The DB resolves the window against the event's own timezone and
    // publishes the instants. When present they win outright, so the phase
    // is identical no matter what timezone the visitor's browser is in.
    const OTTAWA = {
      starts_at: '2026-08-08T15:00:00Z',      // 11:00 EDT
      ends_at: '2026-08-09T03:00:00Z',
      window_opens_at: '2026-08-08T04:00:00Z', // midnight EDT on crawl day
      window_closes_at: '2026-08-09T03:00:00Z',
    }

    it('does not open early for a browser east of the event timezone', () => {
      // The regression: this is the instant the throwaway account checked
      // into all five stops — 21:56 EDT the night before the crawl.
      expect(eventPhase(OTTAWA, 5, at('2026-08-08T01:56:46Z'))).toBe('route_live')
    })

    it('opens at the event-local start of day', () => {
      expect(eventPhase(OTTAWA, 5, at('2026-08-08T03:59:59Z'))).toBe('route_live')
      expect(eventPhase(OTTAWA, 5, at('2026-08-08T04:00:00Z'))).toBe('crawl_day')
    })

    it('wraps at the published close instant', () => {
      expect(eventPhase(OTTAWA, 5, at('2026-08-09T02:59:59Z'))).toBe('crawl_day')
      expect(eventPhase(OTTAWA, 5, at('2026-08-09T03:00:01Z'))).toBe('wrapped')
    })

    it('falls back to the local day when the server sends no window', () => {
      const evt = { ...OTTAWA, window_opens_at: null, window_closes_at: null }
      expect(eventPhase(evt, 5, at('2026-07-29T12:00:00-04:00'))).toBe('route_live')
    })

    it('ignores an unparseable window and falls back', () => {
      const evt = { ...OTTAWA, window_opens_at: 'not-a-date', window_closes_at: null }
      expect(eventPhase(evt, 5, at('2026-07-29T12:00:00-04:00'))).toBe('route_live')
    })
  })
})
