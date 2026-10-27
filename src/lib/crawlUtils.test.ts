import { describe, it, expect, beforeEach } from 'vitest'
import { directionsUrl, loadCrawlCheckoffs, saveCrawlCheckoffs, spreadOverlappingPins } from './crawlUtils'

describe('directionsUrl', () => {
  it('builds a google maps destination url', () => {
    expect(directionsUrl(38.9, -77.03)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=38.9%2C-77.03'
    )
  })
})

describe('crawl checkoffs', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips a set of ids', () => {
    saveCrawlCheckoffs('c1', new Set(['a', 'b']))
    expect(loadCrawlCheckoffs('c1')).toEqual(new Set(['a', 'b']))
  })

  it('is scoped per crawl', () => {
    saveCrawlCheckoffs('c1', new Set(['a']))
    expect(loadCrawlCheckoffs('c2')).toEqual(new Set())
  })

  it('survives corrupt storage', () => {
    localStorage.setItem('crawl-checkoff:c1', '{not json')
    expect(loadCrawlCheckoffs('c1')).toEqual(new Set())
  })

  it('ignores non-string entries', () => {
    localStorage.setItem('crawl-checkoff:c1', JSON.stringify(['a', 3, null]))
    expect(loadCrawlCheckoffs('c1')).toEqual(new Set(['a']))
  })
})

describe('spreadOverlappingPins', () => {
  const placed = (pts: { x: number; y: number }[], minDist = 28) =>
    spreadOverlappingPins(pts, minDist).map((o, i) => ({ x: pts[i].x + o.dx, y: pts[i].y + o.dy }))

  it('leaves well-separated pins alone', () => {
    expect(spreadOverlappingPins([{ x: 0, y: 0 }, { x: 100, y: 0 }])).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }])
  })

  it('separates pins at identical coordinates', () => {
    const out = placed([{ x: 50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 50 }])
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(27.9)
      }
    }
  })

  it('separates near-overlapping pins and keeps far ones fixed', () => {
    const offsets = spreadOverlappingPins([{ x: 10, y: 10 }, { x: 15, y: 12 }, { x: 300, y: 300 }])
    expect(offsets[2]).toEqual({ dx: 0, dy: 0 })
    const out = placed([{ x: 10, y: 10 }, { x: 15, y: 12 }, { x: 300, y: 300 }])
    expect(Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y)).toBeCloseTo(28)
  })
})
