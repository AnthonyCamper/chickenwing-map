import { describe, it, expect, beforeEach } from 'vitest'
import { directionsUrl, loadCrawlCheckoffs, saveCrawlCheckoffs } from './crawlUtils'

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
