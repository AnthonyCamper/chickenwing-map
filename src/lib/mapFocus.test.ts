import { describe, it, expect } from 'vitest'
import { distanceKm, minZoomToFillHeight, pickInitialFocus } from './mapFocus'

const DC = { lat: 38.9, lng: -77.03 }
const BALTIMORE = { lat: 39.29, lng: -76.61 }
const BUFFALO = { lat: 42.89, lng: -78.88 }
const OTTAWA = { lat: 45.42, lng: -75.69 }
const BOSTON = { lat: 42.36, lng: -71.06 }
const LISBON = { lat: 38.72, lng: -9.14 }
const SAO_PAULO = { lat: -23.55, lng: -46.63 }
const LA = { lat: 34.05, lng: -118.24 }

describe('distanceKm', () => {
  it('is zero for the same point and ~470 km DC → Buffalo', () => {
    expect(distanceKm(DC, DC)).toBe(0)
    expect(distanceKm(DC, BUFFALO)).toBeGreaterThan(420)
    expect(distanceKm(DC, BUFFALO)).toBeLessThan(520)
  })
})

describe('pickInitialFocus', () => {
  it('returns small inputs unchanged', () => {
    expect(pickInitialFocus([])).toEqual([])
    expect(pickInitialFocus([DC, LISBON])).toEqual([DC, LISBON])
  })

  it('keeps every spot when they are all in one region', () => {
    const pts = [DC, BALTIMORE, BUFFALO, OTTAWA, BOSTON]
    expect(pickInitialFocus(pts)).toEqual(pts)
  })

  it('drops far-away outliers so the map opens on the dense region, not the world', () => {
    const northEast = [DC, DC, DC, BALTIMORE, BALTIMORE, BUFFALO, OTTAWA, BOSTON]
    const focus = pickInitialFocus([...northEast, LISBON, SAO_PAULO, LA])
    expect(focus).toHaveLength(northEast.length)
    expect(focus).not.toContain(LISBON)
    expect(focus).not.toContain(SAO_PAULO)
    expect(focus).not.toContain(LA)
  })

  it('falls back to every spot when no region holds at least half of them', () => {
    const pts = [DC, LISBON, SAO_PAULO, LA]
    expect(pickInitialFocus(pts)).toEqual(pts)
  })
})

describe('minZoomToFillHeight', () => {
  it('needs zoom 2 for a ~560px phone map and 0 for tiny maps', () => {
    expect(minZoomToFillHeight(560)).toBe(2)
    expect(minZoomToFillHeight(200)).toBe(0)
    expect(minZoomToFillHeight(1100)).toBe(3)
  })
})
