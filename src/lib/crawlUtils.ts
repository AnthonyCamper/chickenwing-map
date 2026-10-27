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

/**
 * Screen-space offsets that keep numbered map pins from sitting on top of
 * each other. Pins closer than `minDist` px (transitively) form a group; each
 * group is fanned out on a small circle around its centre, so stops at the
 * same address — or a block apart at city zoom — stay readable ("4" no
 * longer hides under "1"). Returns one {dx, dy} per input point, in order.
 */
export function spreadOverlappingPins(
  points: { x: number; y: number }[],
  minDist = 28,
): { dx: number; dy: number }[] {
  const n = points.length
  const parent = points.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < minDist) {
        parent[find(j)] = find(i)
      }
    }
  }

  const groups = new Map<number, number[]>()
  points.forEach((_, i) => {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  })

  const offsets = points.map(() => ({ dx: 0, dy: 0 }))
  for (const members of groups.values()) {
    if (members.length < 2) continue
    const cx = members.reduce((s, i) => s + points[i].x, 0) / members.length
    const cy = members.reduce((s, i) => s + points[i].y, 0) / members.length
    // Radius where neighbours on the circle are exactly minDist apart.
    const radius = minDist / (2 * Math.sin(Math.PI / members.length))
    members.forEach((idx, k) => {
      // Start at 12 o'clock and go clockwise in stop order.
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / members.length
      offsets[idx] = {
        dx: cx + radius * Math.cos(angle) - points[idx].x,
        dy: cy + radius * Math.sin(angle) - points[idx].y,
      }
    })
  }
  return offsets
}
