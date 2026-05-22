import { useEffect, useMemo, useRef, useState } from 'react'
import type { SpotWithReviews } from '../lib/types'

interface Props {
  spots: SpotWithReviews[]
  loading?: boolean
}

type ChipType = 'scene' | 'breaking' | 'debate' | 'alert' | 'fact' | 'internet'

interface SceneItem {
  emoji: string
  eyebrow: string
  body: string
  type: ChipType
}

// Eyebrow colours by chip type
const TYPE_COLOR: Record<ChipType, string> = {
  scene:    'text-neon-300',
  breaking: 'text-sauce-300',
  debate:   'text-cherry-300',
  alert:    'text-gold-300',
  fact:     'text-ember-300',
  internet: 'text-cream-300',
}

export default function LiveScene({ spots, loading }: Props) {
  const [redditItems, setRedditItems] = useState<SceneItem[]>([])
  const [tick, setTick]               = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  // Pulse the live dot every 4 s to simulate "real-time" energy
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 4000)
    return () => clearInterval(id)
  }, [])

  // Fetch Reddit r/wings hot posts (public, no auth)
  useEffect(() => {
    let alive = true
    fetch('https://www.reddit.com/r/wings/hot.json?limit=12&raw_json=1', {
      headers: { Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(json => {
        if (!alive) return
        const posts: string[] = (json?.data?.children ?? [])
          .map((c: any) => c?.data?.title as string)
          .filter((t: string) => t && t.length > 10 && t.length < 100)
          .slice(0, 8)

        setRedditItems(
          posts.map(title => ({
            emoji:   '📡',
            eyebrow: 'r/wings',
            body:    title,
            type:    'internet' as ChipType,
          }))
        )
      })
      .catch(() => { /* silent — marquee works fine without reddit */ })
    return () => { alive = false }
  }, [])

  const dataItems  = useMemo(() => buildDataItems(spots), [spots])
  const timeItems  = useMemo(() => buildTimeItems(), [tick]) // rebuilds on tick so hour-of-day refreshes
  const evergreenShuffled = useMemo(() => shuffle([...EVERGREEN]), [])

  // Combine all sources, interleave internet items throughout
  const all = useMemo(() => {
    const base = [...dataItems, ...timeItems, ...evergreenShuffled, ...redditItems]
    return shuffle(base)
  }, [dataItems, timeItems, evergreenShuffled, redditItems])

  if (loading && all.length === 0) return null

  // Duplicate for seamless loop; duration scales with item count
  const track    = [...all, ...all]
  const duration = Math.max(28, all.length * 3.5) // seconds

  return (
    <div
      className="relative bg-night-900 text-cream-50 border-b-2 border-night-900 overflow-hidden select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Grain texture */}
      <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-20" aria-hidden="true" />

      {/* LIVE badge — left anchor */}
      <span className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 px-4 items-center gap-2
                       bg-sauce-500 text-cream-50 text-[10px] font-extrabold uppercase tracking-crowd
                       border-r-2 border-sauce-600">
        {/* Pulsing indicator — flashes on tick */}
        <span
          key={tick}
          className="w-2 h-2 rounded-full bg-cream-50 animate-ping"
          style={{ animationDuration: '0.6s', animationIterationCount: 1 }}
          aria-hidden="true"
        />
        <span>Live</span>
        {spots.length > 0 && (
          <span className="opacity-70">· {spots.length}</span>
        )}
      </span>

      {/* Fade masks on left/right so text doesn't hard-clip */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-[160px] z-[5]
                      bg-gradient-to-r from-night-900 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-[5]
                      bg-gradient-to-l from-night-900 to-transparent" aria-hidden="true" />

      {/* Scrolling track */}
      <div className="relative overflow-hidden py-1.5 sm:pl-[148px]">
        <div
          ref={trackRef}
          className="marquee-track"
          style={{
            animationDuration: `${duration}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
          aria-hidden="true"
        >
          {track.map((it, i) => (
            <Chip key={`${i}-${it.body}`} item={it} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ item }: { item: SceneItem }) {
  const eyebrowColor = TYPE_COLOR[item.type]
  return (
    <span className="inline-flex items-baseline gap-2 px-1 whitespace-nowrap">
      <span className="text-sm leading-none translate-y-[1px]" aria-hidden="true">{item.emoji}</span>
      <span className={`text-[10px] font-extrabold uppercase tracking-crowd ${eyebrowColor}`}>
        {item.eyebrow}
      </span>
      <span className="text-[12px] font-bold text-cream-100 tracking-wide">
        {item.body}
      </span>
      <span className="mx-4 text-cream-50/20 text-xs" aria-hidden="true">🍗</span>
    </span>
  )
}

// ─── Data-driven items (from useReviews spots) ────────────────────────────────

function buildDataItems(spots: SpotWithReviews[]): SceneItem[] {
  const rated = spots.filter(s => s.reviews.length > 0)
  if (rated.length === 0) return []

  const items: SceneItem[] = []

  const king = [...rated].sort((a, b) => b.avg_rating - a.avg_rating)[0]
  if (king) items.push({
    emoji: '👑', eyebrow: 'King of the house', type: 'scene',
    body: `${trunc(king.spot.name, 26)} · ${king.avg_rating.toFixed(1)}/10`,
  })

  const newest = [...rated]
    .map(s => ({ s, r: s.reviews[0] }))
    .filter(x => !!x.r)
    .sort((a, b) => b.r.visited_at.localeCompare(a.r.visited_at))[0]
  if (newest) {
    const who = newest.r.reviewer_name?.split(' ')[0] ?? 'Someone'
    items.push({
      emoji: '🆕', eyebrow: 'Fresh drop', type: 'breaking',
      body: `${who} just put ${trunc(newest.s.spot.name, 20)} on the board`,
    })
  }

  const crowd = [...rated].sort((a, b) => b.reviews.length - a.reviews.length)[0]
  if (crowd && crowd.reviews.length > 1) items.push({
    emoji: '🗣', eyebrow: 'Crowd fav', type: 'scene',
    body: `${trunc(crowd.spot.name, 22)} · ${crowd.reviews.length} ratings and counting`,
  })

  const flav = topFlavor(rated)
  if (flav) items.push({
    emoji: '🌶', eyebrow: 'Flavor heat', type: 'fact',
    body: `${flav.flavor} is running these streets (${flav.count}×)`,
  })

  const totalReviews = rated.reduce((s, x) => s + x.reviews.length, 0)
  items.push({
    emoji: '📊', eyebrow: 'Scene report', type: 'fact',
    body: `${spots.length} spots mapped · ${totalReviews} ratings on the board`,
  })

  const rev = topReviewer(rated)
  if (rev) items.push({
    emoji: '🥇', eyebrow: 'Top rater', type: 'scene',
    body: `${rev.name} dropped ${rev.count} reviews. Respect.`,
  })

  // Lowest-rated spot — shade it
  const bottom = [...rated].filter(s => s.reviews.length >= 2).sort((a, b) => a.avg_rating - b.avg_rating)[0]
  if (bottom && bottom.avg_rating < 6) items.push({
    emoji: '🫤', eyebrow: 'Tough crowd', type: 'debate',
    body: `${trunc(bottom.spot.name, 24)} catching strays — ${bottom.avg_rating.toFixed(1)}/10`,
  })

  // Perfect-10 spotter
  const perfect = rated.flatMap(s => s.reviews).find(r => r.overall_rating === 10)
  if (perfect) items.push({
    emoji: '💯', eyebrow: 'Perfect ten', type: 'alert',
    body: `Someone gave a 10/10. The search is over. Or is it.`,
  })

  return items
}

// ─── Time-of-day items ────────────────────────────────────────────────────────

function buildTimeItems(): SceneItem[] {
  const h = new Date().getHours()
  const items: SceneItem[] = []

  if (h >= 0  && h < 6)  items.push({ emoji: '🦉', eyebrow: 'Night shift',    type: 'alert',   body: "It's past midnight. The fryers never truly close." })
  if (h >= 6  && h < 10) items.push({ emoji: '🌅', eyebrow: 'Early bird',     type: 'alert',   body: 'Wings for breakfast is a valid lifestyle choice.' })
  if (h >= 10 && h < 12) items.push({ emoji: '☀️', eyebrow: 'Mid-morning',    type: 'alert',   body: 'Pre-lunch scouting in progress. Choose wisely.' })
  if (h >= 11 && h < 14) items.push({ emoji: '🏃', eyebrow: 'Lunch rush',     type: 'breaking',body: 'Peak wing hours. The spots are loaded right now.' })
  if (h >= 14 && h < 17) items.push({ emoji: '🕒', eyebrow: 'Afternoon',      type: 'alert',   body: 'Happy hour incoming. Position yourselves.' })
  if (h >= 17 && h < 20) items.push({ emoji: '🌆', eyebrow: 'Prime time',     type: 'breaking',body: 'Dinner rush is live. The sauce is flowing.' })
  if (h >= 20 && h < 23) items.push({ emoji: '🌙', eyebrow: 'Night mode',     type: 'breaking',body: 'Late night crew checking in. No regrets.' })
  if (h >= 23)           items.push({ emoji: '🚨', eyebrow: 'Last call',      type: 'breaking',body: "It's late. You know what to do." })

  // Day of week flavour
  const day = new Date().getDay()
  if (day === 5) items.push({ emoji: '🎉', eyebrow: 'Friday',         type: 'alert',   body: 'It is Friday. The wing gods are watching.' })
  if (day === 6) items.push({ emoji: '🏈', eyebrow: 'Saturday',       type: 'alert',   body: 'Game day energy. Wings first, questions later.' })
  if (day === 0) items.push({ emoji: '😮‍💨', eyebrow: 'Sunday',         type: 'debate',  body: 'Sunday crawl szn. Rest is for after.' })
  if (day === 1) items.push({ emoji: '💀', eyebrow: 'Monday',         type: 'debate',  body: 'Monday hits different. Wings are the cure.' })

  return items
}

// ─── Evergreen pool — shuffled each session ───────────────────────────────────

const EVERGREEN: SceneItem[] = [
  // Debates
  { emoji: '⚖️', eyebrow: 'Debate',        type: 'debate',   body: 'Bone-in vs boneless. Pick a side. No cowards.' },
  { emoji: '🤔', eyebrow: 'Big question',  type: 'debate',   body: 'If a wing has no sauce, is it even a wing?' },
  { emoji: '💬', eyebrow: 'Argument',      type: 'debate',   body: 'Bleu cheese vs ranch. The culture is divided.' },
  { emoji: '🔬', eyebrow: 'Science',       type: 'debate',   body: 'People who order boneless also put pineapple on pizza. Study pending.' },
  { emoji: '🏛️', eyebrow: 'DC says',       type: 'debate',   body: 'Both sides of the aisle agree — lemon pepper hits different.' },
  { emoji: '😮‍💨', eyebrow: 'Controversy',  type: 'debate',   body: 'Someone called sauce "optional." They have not returned.' },
  { emoji: '🫳', eyebrow: 'Dropped',       type: 'debate',   body: 'Dry rub vs wet sauce. No survivors.' },
  { emoji: '📐', eyebrow: 'Standards',     type: 'debate',   body: 'The correct wing size is jumbo. This is not a debate.' },
  // Alerts / breaking
  { emoji: '🚨', eyebrow: 'Alert',         type: 'breaking', body: 'Someone rated a spot 3/10. Investigators are on the scene.' },
  { emoji: '🚔', eyebrow: 'Breaking',      type: 'breaking', body: 'Someone asked for a fork at a wing spot. We do not speak of it.' },
  { emoji: '📢', eyebrow: 'Announcement',  type: 'breaking', body: 'New sauce dropped. Supply chain is insufficient.' },
  { emoji: '🌶', eyebrow: 'Heat alert',    type: 'breaking', body: 'Ghost pepper wings spotted in the wild. Paramedics on standby.' },
  { emoji: '👀', eyebrow: 'Spotted',       type: 'breaking', body: 'Someone dunking in bleu cheese AND ranch simultaneously. Investigators en route.' },
  { emoji: '🛸', eyebrow: 'Unexplained',   type: 'breaking', body: "A 'mild' wing made someone cry. Science has no answers." },
  // Facts / takes
  { emoji: '📊', eyebrow: 'Statistics',    type: 'fact',     body: '67% of arguments at the table are about sauce. The other 33%: bone-in.' },
  { emoji: '🎯', eyebrow: 'Fact',          type: 'fact',     body: 'The best wing is the one in front of you.' },
  { emoji: '⚡', eyebrow: 'Hot take',      type: 'fact',     body: 'The bone is not the problem. You are the problem.' },
  { emoji: '🦅', eyebrow: 'DC dispatch',   type: 'fact',     body: 'The wings of this city will not be disrespected.' },
  { emoji: '💡', eyebrow: 'Pro tip',       type: 'fact',     body: 'Order more than you think you need. You will always think wrong.' },
  { emoji: '🧠', eyebrow: 'Psychology',    type: 'fact',     body: 'Nobody has ever said "I wish I ordered fewer wings."' },
  { emoji: '📜', eyebrow: 'Law',           type: 'fact',     body: 'Every great night starts with a wing order. This is statistically verified.' },
  { emoji: '🫡', eyebrow: 'Respect',       type: 'fact',     body: 'Shoutout to everyone eating wings alone right now. Legends.' },
  // Vibe / scene
  { emoji: '🎭', eyebrow: 'Drama',         type: 'scene',    body: 'Someone posted their rating on main. The comments are a warzone.' },
  { emoji: '🎵', eyebrow: 'Go-go verified',type: 'scene',    body: 'These wings got the whole block moving.' },
  { emoji: '🏆', eyebrow: 'Unverified',    type: 'scene',    body: 'Someone claims to have found the perfect spot. Investigation ongoing.' },
  { emoji: '📱', eyebrow: 'Viral',         type: 'scene',    body: 'Wing pic dropped. It\'s already in three group chats.' },
  { emoji: '🌙', eyebrow: 'Late night',    type: 'scene',    body: 'The real reviews come in after midnight.' },
  { emoji: '🎪', eyebrow: 'Crawl report',  type: 'scene',    body: 'Stop 3 hit different. You had to be there.' },
  { emoji: '🏅', eyebrow: 'Recognition',   type: 'scene',    body: 'Shoutout to whoever found the spot nobody\'s talking about yet.' },
  { emoji: '🔑', eyebrow: 'Keys',          type: 'scene',    body: 'Find the spot. Rate the spot. Share the spot. That\'s the culture.' },
  // Lemon pepper extended universe
  { emoji: '🍋', eyebrow: 'LP report',     type: 'fact',     body: 'Lemon pepper: still undefeated. Updated hourly.' },
  { emoji: '🍋', eyebrow: 'LP debate',     type: 'debate',   body: 'Wet lemon pepper vs dry. This is not a safe space.' },
  { emoji: '🍋', eyebrow: 'LP weekly',     type: 'alert',    body: 'Lemon pepper sales up 40% in the district this quarter. Allegedly.' },
  // Misc funny
  { emoji: '💀', eyebrow: 'RIP',           type: 'alert',    body: "A man ordered 'well-done' wings. We do not speak of this." },
  { emoji: '🤯', eyebrow: 'Mind blown',    type: 'alert',    body: 'Someone finished a 50-piece alone. They are fine. They are not fine.' },
  { emoji: '😤', eyebrow: 'Critic',        type: 'debate',   body: "A 5/10 review was posted. The reviewer's location is being triangulated." },
  { emoji: '🛡️', eyebrow: 'Protection',   type: 'debate',   body: 'Ranch is not a dipping sauce. Ranch is a lifestyle. Defend it.' },
  { emoji: '🧊', eyebrow: 'Styrofoam',    type: 'fact',     body: 'Styrofoam container appreciation post. It keeps the heat. Respect it.' },
  { emoji: '🎓', eyebrow: 'Education',     type: 'fact',     body: 'Nobody leaves this platform without knowing their flavor preference. We insist.' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function topFlavor(spots: SpotWithReviews[]): { flavor: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const s of spots) for (const r of s.reviews) {
    const f = (r.wing_flavor ?? '').trim()
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  let best: [string, number] = ['', 0]
  for (const [k, v] of counts) if (v > best[1]) best = [k, v]
  return best[1] > 0 ? { flavor: best[0], count: best[1] } : null
}

function topReviewer(spots: SpotWithReviews[]): { name: string; count: number } | null {
  const counts = new Map<string, number>()
  for (const s of spots) for (const r of s.reviews) {
    const n = r.reviewer_name?.trim()
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  let best: [string, number] = ['', 0]
  for (const [k, v] of counts) if (v > best[1]) best = [k, v]
  return best[1] > 0 ? { name: best[0].split(' ')[0], count: best[1] } : null
}
