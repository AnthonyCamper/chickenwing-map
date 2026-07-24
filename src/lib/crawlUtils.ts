const KEY = (crawlId: string) => `crawl-checkoff:${crawlId}`

/** Google Maps directions deep link — works on iOS/Android/desktop. */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`
}

/** Which crawl items the viewer has checked off, persisted locally per device. */
export function loadCrawlCheckoffs(crawlId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(crawlId))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

export function saveCrawlCheckoffs(crawlId: string, ids: Set<string>): void {
  try {
    localStorage.setItem(KEY(crawlId), JSON.stringify([...ids]))
  } catch {
    // Storage full or blocked — check-offs are best-effort local state.
  }
}
