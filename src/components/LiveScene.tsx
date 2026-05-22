import { useMemo } from 'react'
import type { SpotWithReviews } from '../lib/types'

interface Props {
  spots: SpotWithReviews[]
  loading?: boolean
}

interface SceneItem {
  emoji: string
  eyebrow: string
  body: string
}

/**
 * Live scene marquee — a thin dark band of community-pulse chips that
 * sits under the header. Derives everything from the spots payload that
 * useReviews already loads, no extra queries.
 */
export default function LiveScene({ spots, loading }: Props) {
  const items = useMemo(() => buildSceneItems(spots), [spots])

  if (loading && items.length === 0) return null

  // Render the track twice so the marquee loops seamlessly
  const track = [...items, ...items]

  return (
    <div className="relative bg-night-800 text-cream-50 border-b-2 border-night-900 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-30" aria-hidden="true" />

      {/* "LIVE" pill — fixed on the left edge on sm+ */}
      <span className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 px-3 items-center
                       bg-sauce-500 text-cream-50 text-[10px] font-extrabold uppercase tracking-crowd
                       border-r-2 border-night-900">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cream-50 animate-pulse" aria-hidden="true" />
          Live · {spots.length} spots
        </span>
      </span>

      <div className="relative marquee py-2 sm:pl-[140px]">
        <div className="marquee-track">
          {track.map((it, i) => (
            <SceneChip key={`${i}-${it.body}`} {...it} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SceneChip({ emoji, eyebrow, body }: SceneItem) {
  return (
    <span className="inline-flex items-baseline gap-2 px-1">
      <span className="text-base leading-none translate-y-[1px]" aria-hidden="true">{emoji}</span>
      <span className="text-[10px] font-extrabold uppercase tracking-crowd text-sauce-300">
        {eyebrow}
      </span>
      <span className="text-[12px] font-bold uppercase tracking-tightest text-cream-50">
        {body}
      </span>
      <span className="mx-3 text-cream-50/30" aria-hidden="true">/</span>
    </span>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Item builder
// ────────────────────────────────────────────────────────────────────────────

const EVERGREEN: SceneItem[] = [
  { emoji: '🌶', eyebrow: 'Hot take', body: "Who's got the best lemon pepper?" },
  { emoji: '🥊', eyebrow: 'Debate',    body: 'DC is arguing again' },
  { emoji: '🚨', eyebrow: 'Tonight',   body: "Drop tonight's hottest spots" },
  { emoji: '👑', eyebrow: 'Crown',     body: 'Rank it or drop it' },
  { emoji: '🔥', eyebrow: 'Late nite', body: 'Saucy reviews after midnight' },
]

function buildSceneItems(spots: SpotWithReviews[]): SceneItem[] {
  const ratedSpots = spots.filter(s => s.reviews.length > 0)
  if (ratedSpots.length === 0) return EVERGREEN

  const items: SceneItem[] = []

  // KING — highest avg rating (min 1 review)
  const king = [...ratedSpots].sort((a, b) => b.avg_rating - a.avg_rating)[0]
  if (king) {
    items.push({
      emoji: '👑',
      eyebrow: 'King of the house',
      body: `${truncate(king.spot.name, 28)} · ${king.avg_rating.toFixed(1)}/10`,
    })
  }

  // NEW DROP — most recently reviewed spot (reviews are sorted newest-first inside spot)
  const newest = [...ratedSpots]
    .map(s => ({ spot: s, latest: s.reviews[0] }))
    .filter(x => !!x.latest)
    .sort((a, b) => (b.latest!.visited_at).localeCompare(a.latest!.visited_at))[0]
  if (newest?.latest) {
    const who = newest.latest.reviewer_name?.split(' ')[0] ?? 'Someone'
    items.push({
      emoji: '🆕',
      eyebrow: 'New drop',
      body: `${who} put ${truncate(newest.spot.spot.name, 22)} on the board`,
    })
  }

  // CROWD FAV — most reviewed spot
  const popular = [...ratedSpots].sort((a, b) => b.reviews.length - a.reviews.length)[0]
  if (popular && popular.reviews.length > 1) {
    items.push({
      emoji: '🗣',
      eyebrow: 'Crowd favorite',
      body: `${truncate(popular.spot.name, 24)} · ${popular.reviews.length} ratings`,
    })
  }

  // FLAVOR HEAT — most-mentioned wing flavor
  const flavorTop = topFlavor(ratedSpots)
  if (flavorTop) {
    items.push({
      emoji: '🌶',
      eyebrow: 'Flavor heat',
      body: `${flavorTop.flavor} is running the streets (${flavorTop.count})`,
    })
  }

  // SCENE COUNTS — totals
  const totalReviews = ratedSpots.reduce((s, x) => s + x.reviews.length, 0)
  items.push({
    emoji: '📍',
    eyebrow: 'The scene',
    body: `${spots.length} spots · ${totalReviews} ratings logged`,
  })

  // Top scorer reviewer
  const reviewerTop = topReviewer(ratedSpots)
  if (reviewerTop) {
    items.push({
      emoji: '🥇',
      eyebrow: 'Top rater',
      body: `${reviewerTop.name} dropped ${reviewerTop.count}`,
    })
  }

  // Salt with a couple of evergreen chips so the loop never feels too short
  if (items.length < 6) items.push(...EVERGREEN.slice(0, 6 - items.length))

  return items
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function topFlavor(spots: SpotWithReviews[]): { flavor: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const s of spots) {
    for (const r of s.reviews) {
      const f = (r.wing_flavor ?? '').trim()
      if (!f) continue
      counts.set(f, (counts.get(f) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  let best: [string, number] = ['', 0]
  for (const [k, v] of counts) if (v > best[1]) best = [k, v]
  return best[1] > 0 ? { flavor: best[0], count: best[1] } : null
}

function topReviewer(spots: SpotWithReviews[]): { name: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const s of spots) {
    for (const r of s.reviews) {
      const name = r.reviewer_name?.trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  let best: [string, number] = ['', 0]
  for (const [k, v] of counts) if (v > best[1]) best = [k, v]
  return best[1] > 0 ? { name: best[0].split(' ')[0], count: best[1] } : null
}
