import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'

const db = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; name: string; address: string; lat: number; lng: number }>,
  ilike: [] as string[],
}))

vi.mock('../../lib/supabase', () => {
  const builder = () => {
    const b: Record<string, unknown> = {}
    for (const m of ['select', 'order', 'limit', 'abortSignal']) b[m] = () => b
    b.ilike = (_col: string, pattern: string) => { db.ilike.push(pattern); return b }
    b.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: db.rows, error: null }).then(resolve, reject)
    return b
  }
  return { supabase: { from: () => builder() } }
})

import BusinessAutocomplete, { spotNamePattern, viewboxFromSpots, type Suggestion } from './BusinessAutocomplete'

const fetchMock = vi.fn()

beforeEach(() => {
  db.rows = []
  db.ilike = []
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ json: async () => [] })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function Harness({ onSelect }: { onSelect: (s: Suggestion) => void }) {
  const [v, setV] = useState('')
  return <BusinessAutocomplete id="q" value={v} onChange={setV} onSelect={onSelect} />
}

describe('spotNamePattern', () => {
  it('turns spaces and punctuation into wildcards', () => {
    expect(spotNamePattern('Ale Marys')).toBe('%Ale%Marys%')
    expect(spotNamePattern("mary's")).toBe('%mary%s%')
    expect(spotNamePattern('50% off_')).toBe('%50%off%')
  })

  it('returns null when nothing searchable is left', () => {
    expect(spotNamePattern('  -- ')).toBeNull()
  })
})

describe('viewboxFromSpots', () => {
  it('ignores far-off outliers and junk 0,0 spots', () => {
    const spots = [
      ...Array.from({ length: 18 }, (_, i) => ({ lat: 38 + i * 0.2, lng: -77 - i * 0.1 })),
      { lat: 0, lng: 0 },
      { lat: -27.7, lng: 153 },   // Australia
      { lat: 55.6, lng: 13.3 },   // Europe
    ]
    const box = viewboxFromSpots(spots)!
    const [left, top, right, bottom] = box.split(',').map(Number)
    expect(left).toBeGreaterThan(-80)
    expect(right).toBeLessThan(-70)
    expect(bottom).toBeGreaterThan(35)
    expect(top).toBeLessThan(45)
  })

  it('returns null with no usable spots', () => {
    expect(viewboxFromSpots([{ lat: 0, lng: 0 }])).toBeNull()
  })
})

describe('BusinessAutocomplete', () => {
  it('lists spots already on WingMap first, labelled, and drops map duplicates of them', async () => {
    db.rows = [{ id: 's1', name: 'Ale Marys', address: '1939 Fleet St, Baltimore, MD 21231', lat: 39.2847, lng: -76.5935 }]
    fetchMock.mockResolvedValue({
      json: async () => [
        // Same place from OpenStreetMap: should be hidden
        { place_id: 1, name: 'Ale Marys', display_name: 'Ale Marys, Baltimore', lat: '39.2848', lon: '-76.5936', class: 'amenity', type: 'bar' },
        // A town is not a wing spot
        { place_id: 2, name: 'Alemar', display_name: 'Alemar, Somewhere', lat: '10', lon: '10', class: 'place', type: 'town' },
        { place_id: 3, name: 'Ale House', display_name: 'Ale House, Baltimore', lat: '39.3', lon: '-76.6', class: 'amenity', type: 'pub' },
      ],
    })
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Ale Marys' } })

    await screen.findByText('Ale House')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('Ale Marys')
    expect(options[0]).toHaveTextContent('Already on WingKingTony · 1939 Fleet St')
    expect(screen.queryByText('Alemar')).not.toBeInTheDocument()
    expect(db.ilike).toContain('%Ale%Marys%')

    fireEvent.mouseDown(options[0])
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      source: 'wingmap',
      spotId: 's1',
      name: 'Ale Marys',
      address: '1939 Fleet St, Baltimore, MD 21231',
      lat: '39.2847',
      lng: '-76.5935',
    }))
  })

  it('biases map search toward WingMap spots when location is not shared', async () => {
    db.rows = Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, name: `Spot ${i}`, address: '', lat: 39 + i * 0.1, lng: -77 + i * 0.1 }))
    render(<Harness onSelect={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Wingstop' } })
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('viewbox')).toBeTruthy()
    expect(url.searchParams.get('bounded')).toBe('0')
  })

  it('shows a searching state, then a plain empty state', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    fetchMock.mockReturnValue(new Promise(r => { resolveFetch = r }))
    render(<Harness onSelect={vi.fn()} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Nowhere Wings' } })
    expect(await screen.findByText('Searching…')).toBeInTheDocument()
    resolveFetch({ json: async () => [] })
    expect(await screen.findByText('No matches. Check the spelling or add the address below.')).toBeInTheDocument()
  })

  it('respects maxLength', () => {
    render(<BusinessAutocomplete value="" onChange={vi.fn()} onSelect={vi.fn()} maxLength={120} />)
    expect(screen.getByRole('combobox')).toHaveAttribute('maxLength', '120')
  })
})
