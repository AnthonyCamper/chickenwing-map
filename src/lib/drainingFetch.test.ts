import { describe, it, expect, vi, afterEach } from 'vitest'
import { drainingFetch } from './drainingFetch'

afterEach(() => vi.unstubAllGlobals())

describe('drainingFetch (S25)', () => {
  it('reads the empty body of a HEAD response and keeps status and headers', async () => {
    const original = new Response(null, { status: 200, headers: { 'content-range': '0-0/7' } })
    const read = vi.spyOn(original, 'arrayBuffer')
    vi.stubGlobal('fetch', vi.fn(async () => original))
    const res = await drainingFetch('http://x/rest/v1/notifications', { method: 'HEAD' })
    expect(read).toHaveBeenCalled()
    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(res.headers.get('content-range')).toBe('0-0/7')
  })

  it('reads a 204 (logout) body too', async () => {
    const original = new Response(null, { status: 204 })
    const read = vi.spyOn(original, 'arrayBuffer')
    vi.stubGlobal('fetch', vi.fn(async () => original))
    const res = await drainingFetch('http://x/auth/v1/logout', { method: 'POST' })
    expect(read).toHaveBeenCalled()
    expect(res.status).toBe(204)
  })

  it('passes other responses through untouched', async () => {
    const original = new Response('[1]', { status: 200 })
    vi.stubGlobal('fetch', vi.fn(async () => original))
    expect(await drainingFetch('http://x/rest/v1/spots')).toBe(original)
  })
})
