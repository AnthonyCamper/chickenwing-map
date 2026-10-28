// Where the Map tab should open. Fitting every spot made the map open on the
// whole world as soon as one spot was in Europe or South America, so a new
// visitor saw a planet with a few bubbles and had to tap 4–5 times to reach
// pins. Instead, open on the region that holds most of the spots.

export interface LatLngPoint {
  lat: number
  lng: number
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLngPoint, b: LatLngPoint): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The spots the map should fit when it first opens: the largest group of
 * spots within `radiusKm` of one spot (a region, e.g. the US north-east),
 * provided that group holds at least `minShare` of all spots. Otherwise
 * (spots spread evenly) every spot. Returns the input unchanged for 0–2
 * spots or when everything already sits in one region.
 */
export function pickInitialFocus<T extends LatLngPoint>(
  points: T[],
  { radiusKm = 1000, minShare = 0.5 }: { radiusKm?: number; minShare?: number } = {},
): T[] {
  if (points.length <= 2) return points

  let best: T[] = []
  for (const centre of points) {
    const group = points.filter(p => distanceKm(centre, p) <= radiusKm)
    if (group.length > best.length) best = group
    if (best.length === points.length) return points
  }
  return best.length >= points.length * minShare ? best : points
}

/** Lowest zoom at which a 256px-tile world is at least as tall as the map,
 *  so zooming out never shows an empty band above or below the world. */
export function minZoomToFillHeight(heightPx: number): number {
  if (!Number.isFinite(heightPx) || heightPx <= 256) return 0
  return Math.ceil(Math.log2(heightPx / 256))
}
