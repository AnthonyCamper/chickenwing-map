#!/usr/bin/env node
// Post-build step for GitHub Pages (runs as part of `npm run build`).
//
// Pages has no SPA rewrite rule: a request for /spots/x or /login used to get
// public/404.html, which bounced the browser to /?p=/spots/x — HTTP 404, a
// console error, and the whole app loaded twice on 3G. Instead:
//
//  (a) dist/404.html = a copy of the built dist/index.html, so ANY unknown
//      path boots the app in one load at the right URL. (Assets use absolute
//      /assets/... URLs, so the copy works at any depth.) Pages still sends
//      that response with status 404 — unavoidable for dynamic routes like
//      /spots/:slug, /reviews/:id, /u/:username, /lists/:slug, /events/:slug.
//  (b) dist/<route>/index.html (+ dist/<route>.html) for the fixed routes, so
//      those answer 200. Pages redirects /login to /login/ for the directory
//      form; index.html strips the trailing slash before the router starts.
//
// Usage: node scripts/pages-spa-fallback.mjs [distDir]   (default: dist)

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

// Routes in src/App.tsx with no parameters (besides "/", which is index.html).
export const STATIC_ROUTES = [
  'events',
  'login',
  'register',
  'privacy',
  'terms',
  'lists/new',
  'reset-password',
]

export function writeSpaFallbacks(distDir) {
  const indexHtml = join(distDir, 'index.html')
  if (!existsSync(indexHtml)) {
    throw new Error(`${indexHtml} not found — run vite build first`)
  }
  if (!/<script[^>]+src="\/assets\//.test(readFileSync(indexHtml, 'utf8'))) {
    // A relative asset base would break every copy below the root.
    throw new Error('dist/index.html does not load /assets/... with an absolute URL; check `base` in vite.config.ts')
  }

  const written = []
  const copyTo = (rel) => {
    const target = join(distDir, rel)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(indexHtml, target)
    written.push(rel)
  }

  copyTo('404.html')
  for (const route of STATIC_ROUTES) {
    copyTo(`${route}/index.html`)
    copyTo(`${route}.html`)
  }
  return written
}

// Run as a script (not when imported by a test)
if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  const dist = resolve(process.argv[2] ?? 'dist')
  const written = writeSpaFallbacks(dist)
  console.log(`pages-spa-fallback: wrote ${written.length} copies of index.html into ${dist}`)
}
