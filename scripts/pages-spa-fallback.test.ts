import { describe, it, expect } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error plain .mjs build script, no type declarations
import { writeSpaFallbacks, STATIC_ROUTES } from './pages-spa-fallback.mjs'

const INDEX = '<!doctype html><html><head><script type="module" crossorigin src="/assets/index-abc.js"></script></head><body><div id="root"></div></body></html>'

describe('pages-spa-fallback', () => {
  it('writes 404.html and a copy per static route, identical to index.html', () => {
    const dist = mkdtempSync(join(tmpdir(), 'spa-'))
    writeFileSync(join(dist, 'index.html'), INDEX)
    writeSpaFallbacks(dist)
    expect(readFileSync(join(dist, '404.html'), 'utf8')).toBe(INDEX)
    for (const route of STATIC_ROUTES as string[]) {
      expect(readFileSync(join(dist, route, 'index.html'), 'utf8')).toBe(INDEX)
      expect(existsSync(join(dist, `${route}.html`))).toBe(true)
    }
    expect(STATIC_ROUTES).toEqual(expect.arrayContaining(['login', 'register', 'events', 'privacy', 'terms', 'lists/new', 'reset-password']))
  })

  it('refuses a build whose assets are relative (copies below the root would break)', () => {
    const dist = mkdtempSync(join(tmpdir(), 'spa-'))
    writeFileSync(join(dist, 'index.html'), INDEX.replace('/assets/', './assets/'))
    expect(() => writeSpaFallbacks(dist)).toThrow(/absolute/)
  })
})
