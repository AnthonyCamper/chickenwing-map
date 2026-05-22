import { useEffect, useRef, useState } from 'react'
import type { SpotWithReviews } from '../lib/types'

interface Props {
  spots: SpotWithReviews[]
  loading?: boolean
}

type ChipType = 'scene' | 'breaking' | 'debate' | 'alert' | 'fact' | 'internet' | 'onion'

interface SceneItem {
  emoji: string
  eyebrow: string
  body: string
  type: ChipType
  url?: string   // if set, chip becomes a clickable link
}

const TYPE_COLOR: Record<ChipType, string> = {
  scene:    'text-neon-300',
  breaking: 'text-sauce-300',
  debate:   'text-cherry-300',
  alert:    'text-gold-300',
  fact:     'text-ember-300',
  internet: 'text-cream-300',
  onion:    'text-sauce-200',
}

export default function LiveScene({ spots, loading }: Props) {
  const [pool, setPool]         = useState<SceneItem[]>([])
  const [duration, setDuration] = useState(40)
  const [paused, setPaused]     = useState(false)
  const built = useRef(false)

  useEffect(() => {
    if (built.current || loading) return
    built.current = true

    const dataItems = buildDataItems(spots)
    const timeItems = buildTimeItems()

    const fetchSub = (sub: string): Promise<SceneItem[]> =>
      fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10&raw_json=1`, {
        headers: { Accept: 'application/json' },
      })
        .then(r => r.json())
        .then(json =>
          ((json?.data?.children ?? []) as any[])
            .map(c => c?.data)
            .filter(d => d?.title && d.title.length > 10 && d.title.length < 120)
            .slice(0, 6)
            .map(d => ({
              emoji:   '📡',
              eyebrow: `r/${sub}`,
              body:    d.title as string,
              type:    'internet' as ChipType,
              url:     `https://www.reddit.com${d.permalink}`,
            }))
        )
        .catch(() => [] as SceneItem[])

    const redditPromise = Promise.all([
      fetchSub('wings'),
      fetchSub('chickenwings'),
    ]).then(([a, b]) => [...a, ...b])

    const timeout: Promise<SceneItem[]> = new Promise(res =>
      setTimeout(() => res([]), 2500)
    )

    Promise.race([redditPromise, timeout]).then(redditItems => {
      const all = shuffle([...dataItems, ...timeItems, ...EVERGREEN, ...ONION, ...redditItems])
      setPool(all)
      setDuration(Math.max(32, all.length * 3.2))
    })
  }, [spots, loading])

  if (pool.length === 0) return null

  const track = [...pool, ...pool]

  return (
    <div
      className="relative bg-night-900 text-cream-50 border-b-2 border-night-900 overflow-hidden select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-halftone-dark opacity-20" aria-hidden="true" />

      {/* LIVE badge */}
      <div className="hidden sm:flex absolute left-0 top-0 bottom-0 z-10 px-4 items-center gap-2
                      bg-sauce-500 border-r-2 border-sauce-600 text-cream-50 text-[10px]
                      font-extrabold uppercase tracking-crowd flex-shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cream-50 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cream-50" />
        </span>
        <span>Live</span>
        {spots.length > 0 && <span className="opacity-60">· {spots.length}</span>}
      </div>

      {/* Edge fades */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-[160px] z-[5]
                      bg-gradient-to-r from-night-900 to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 z-[5]
                      bg-gradient-to-l from-night-900 to-transparent" aria-hidden="true" />

      <div className="overflow-hidden py-1.5 sm:pl-[148px]">
        <div
          className="marquee-track"
          style={{
            animationDuration: `${duration}s`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        >
          {track.map((it, i) => (
            <Chip key={i} item={it} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Chip({ item }: { item: SceneItem }) {
  const eyebrowColor = TYPE_COLOR[item.type]
  const inner = (
    <span className="inline-flex items-baseline gap-2 px-1 whitespace-nowrap">
      <span className="text-sm leading-none translate-y-[1px]">{item.emoji}</span>
      <span className={`text-[10px] font-extrabold uppercase tracking-crowd ${eyebrowColor}`}>
        {item.eyebrow}
      </span>
      <span className={`text-[12px] font-bold tracking-wide ${item.url ? 'text-cream-50 underline underline-offset-2 decoration-cream-50/30 hover:decoration-cream-50' : 'text-cream-100'}`}>
        {item.body}
      </span>
      <span className="mx-4 text-cream-50/20 text-xs">🍗</span>
    </span>
  )

  if (item.url) {
    return (
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="cursor-pointer"
        onClick={e => e.stopPropagation()}
      >
        {inner}
      </a>
    )
  }
  return <span>{inner}</span>
}

// ─── Data-driven items ────────────────────────────────────────────────────────

function buildDataItems(spots: SpotWithReviews[]): SceneItem[] {
  const rated = spots.filter(s => s.reviews.length > 0)
  if (rated.length === 0) return []
  const items: SceneItem[] = []

  const king = [...rated].sort((a, b) => b.avg_rating - a.avg_rating)[0]
  if (king) items.push({ emoji: '👑', eyebrow: 'King of the house', type: 'scene',
    body: `${trunc(king.spot.name, 26)} · ${king.avg_rating.toFixed(1)}/10` })

  const newest = [...rated].map(s => ({ s, r: s.reviews[0] })).filter(x => !!x.r)
    .sort((a, b) => b.r.visited_at.localeCompare(a.r.visited_at))[0]
  if (newest) {
    const who = newest.r.reviewer_name?.split(' ')[0] ?? 'Someone'
    items.push({ emoji: '🆕', eyebrow: 'Fresh drop', type: 'breaking',
      body: `${who} just put ${trunc(newest.s.spot.name, 20)} on the board` })
  }

  const crowd = [...rated].sort((a, b) => b.reviews.length - a.reviews.length)[0]
  if (crowd && crowd.reviews.length > 1) items.push({ emoji: '🗣', eyebrow: 'Crowd fav', type: 'scene',
    body: `${trunc(crowd.spot.name, 22)} · ${crowd.reviews.length} ratings and counting` })

  const flav = topFlavor(rated)
  if (flav) items.push({ emoji: '🌶', eyebrow: 'Flavor heat', type: 'fact',
    body: `${flav.flavor} is running these streets (${flav.count}×)` })

  const totalReviews = rated.reduce((s, x) => s + x.reviews.length, 0)
  items.push({ emoji: '📊', eyebrow: 'Scene report', type: 'fact',
    body: `${spots.length} spots mapped · ${totalReviews} ratings logged` })

  const rev = topReviewer(rated)
  if (rev) items.push({ emoji: '🥇', eyebrow: 'Top rater', type: 'scene',
    body: `${rev.name} dropped ${rev.count} reviews. Respect.` })

  const bottom = [...rated].filter(s => s.reviews.length >= 2).sort((a, b) => a.avg_rating - b.avg_rating)[0]
  if (bottom && bottom.avg_rating < 6) items.push({ emoji: '🫤', eyebrow: 'Tough crowd', type: 'debate',
    body: `${trunc(bottom.spot.name, 24)} catching strays — ${bottom.avg_rating.toFixed(1)}/10` })

  const perfect = rated.flatMap(s => s.reviews).find(r => r.overall_rating === 10)
  if (perfect) items.push({ emoji: '💯', eyebrow: 'Perfect ten', type: 'alert',
    body: 'Someone gave a 10/10. The search is over. Or is it.' })

  return items
}

function buildTimeItems(): SceneItem[] {
  const h   = new Date().getHours()
  const day = new Date().getDay()
  const items: SceneItem[] = []

  if (h < 6)        items.push({ emoji: '🦉', eyebrow: 'Night shift',  type: 'alert',    body: "It's past midnight. The fryers never truly close." })
  else if (h < 10)  items.push({ emoji: '🌅', eyebrow: 'Early bird',   type: 'alert',    body: 'Wings for breakfast is a valid lifestyle choice.' })
  else if (h < 12)  items.push({ emoji: '☀️', eyebrow: 'Mid-morning', type: 'alert',    body: 'Pre-lunch scouting in progress. Choose wisely.' })
  else if (h < 14)  items.push({ emoji: '🏃', eyebrow: 'Lunch rush',   type: 'breaking', body: 'Peak wing hours. The spots are loaded right now.' })
  else if (h < 17)  items.push({ emoji: '🕒', eyebrow: 'Afternoon',    type: 'alert',    body: 'Happy hour incoming. Position yourselves.' })
  else if (h < 20)  items.push({ emoji: '🌆', eyebrow: 'Prime time',   type: 'breaking', body: 'Dinner rush is live. The sauce is flowing.' })
  else if (h < 23)  items.push({ emoji: '🌙', eyebrow: 'Night mode',   type: 'breaking', body: 'Late night crew checking in. No regrets.' })
  else              items.push({ emoji: '🚨', eyebrow: 'Last call',    type: 'breaking', body: "It's late. You know what to do." })

  if (day === 5) items.push({ emoji: '🎉', eyebrow: 'Friday',   type: 'alert',  body: 'It is Friday. The wing gods are watching.' })
  if (day === 6) items.push({ emoji: '🏈', eyebrow: 'Saturday', type: 'alert',  body: 'Game day energy. Wings first, questions later.' })
  if (day === 0) items.push({ emoji: '😮‍💨', eyebrow: 'Sunday',  type: 'debate', body: 'Sunday crawl szn. Rest is for after.' })
  if (day === 1) items.push({ emoji: '💀', eyebrow: 'Monday',   type: 'debate', body: 'Monday hits different. Wings are the cure.' })

  return items
}

// ─── Onion-style deadpan news headlines ──────────────────────────────────────

const ONION: SceneItem[] = [
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Area Man Drives 45 Minutes For Wings, Rates 6/10, Will Return Next Week' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Local Woman Describes Wing Sauce As "Giving" — Experts Remain Baffled' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Wing Spot Receives First 10/10 Review; Owner Claims He "Knew It All Along"' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Man Who Ordered Mild Wings Still Crying, Sources Confirm' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Nation Divided After Photo Of Boneless Wings Labeled As Wings' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Scientists Confirm: No Amount Of Ranch Will Fix Bad Wings' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'D.C. Man Sets Personal Record Of 47 Wings Before Questioning Life Choices' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Local Food Critic Gives Wings 4/10; Found Hiding In Witness Protection' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Study: People Who Don\'t Finish Their Wings Are A Completely Different Kind Of Person' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Wing Spot Owner Insists "The Sauce Is The Same" Despite Widespread Community Outcry' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Man Describes Wings As "Mid" — Crowd Goes Silent, Waiter Asks Him To Leave' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'D.C. Wing Crawl Participant Has Not Been Seen Since Stop 5; Friends Unworried' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Area Couple\'s Date Night Ruined After One Orders Well Done; Counseling Sought' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Report: Man Fully Committed To Rating Wings "Tomorrow" For Past 3 Weeks' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Local Hero Finishes Entire Order, Posts Review Immediately, Cites "Civic Duty"' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Lemon Pepper Wing Declared Sentient After Surviving Contact With Bleu Cheese' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Woman Who Said "Just One More" Currently On Wing Number 19' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'New Sauce Described As "Smoky" By Person Who Has Never Experienced Smoke' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Area Table Orders 100 Wings "To Share" — No One Sharing' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Man Gives Spot 7/10, Refuses To Elaborate, Leaves Town' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Group Chat Unanimously Agrees On Wing Spot; First Time In Recorded History' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Styrofoam Container Described As "Giving The Wings Character" By Someone Wrong' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Friend Who "Isn\'t That Hungry" Eats 14 Wings, Reports No Memory Of Event' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Wing Spot Opens At 11am; Man Already There At 10:45; Refuses Eye Contact' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Local Man\'s Wing Rating Philosophy Takes 20 Minutes To Explain, Collapses Under Questioning' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Takeout Order Described As "For The Table" Eaten Entirely In Car Before Arriving Home' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Hot Wing Challenge Completed; Participant Claims Victory Despite Visible Evidence To The Contrary' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Garlic Parmesan Wing Described As "Not Really A Wing Wing" By Man Who Is Wrong' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Region\'s Foremost Wing Expert Self-Appointed; Nobody Has Challenged This' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Person Who Said "I Could Make These At Home" Has Not Made Them At Home' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Wing Sauce Described As "Complex" By Person Who Ordered The Mildest Option' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Eleven-Wing Order Deemed "Odd Number" By Someone Who Has Clearly Never Been Hungry' },
  { emoji: '📰', eyebrow: 'Developing', type: 'onion', body: 'Man Returns To Same Spot 12 Times, Still Hasn\'t Tried Anything Other Than Lemon Pepper' },
]

// ─── General evergreen pool ───────────────────────────────────────────────────

const EVERGREEN: SceneItem[] = [
  { emoji: '⚖️', eyebrow: 'Debate',        type: 'debate',   body: 'Bone-in vs boneless. Pick a side. No cowards.' },
  { emoji: '🤔', eyebrow: 'Big question',  type: 'debate',   body: 'If a wing has no sauce, is it even a wing?' },
  { emoji: '💬', eyebrow: 'Argument',      type: 'debate',   body: 'Bleu cheese vs ranch. The culture is divided.' },
  { emoji: '🔬', eyebrow: 'Science',       type: 'debate',   body: 'People who order boneless also put pineapple on pizza. Study pending.' },
  { emoji: '🏛️', eyebrow: 'DC says',       type: 'debate',   body: 'Both sides of the aisle agree — lemon pepper hits different.' },
  { emoji: '😮‍💨', eyebrow: 'Controversy', type: 'debate',   body: 'Someone called sauce "optional." They have not returned.' },
  { emoji: '🫳', eyebrow: 'Dropped',       type: 'debate',   body: 'Dry rub vs wet sauce. No survivors.' },
  { emoji: '📐', eyebrow: 'Standards',     type: 'debate',   body: 'The correct wing size is jumbo. This is not a debate.' },
  { emoji: '🚨', eyebrow: 'Alert',         type: 'breaking', body: 'Someone rated a spot 3/10. Investigators are on the scene.' },
  { emoji: '🚔', eyebrow: 'Breaking',      type: 'breaking', body: 'Someone asked for a fork at a wing spot. We do not speak of it.' },
  { emoji: '📢', eyebrow: 'Announcement',  type: 'breaking', body: 'New sauce dropped. Supply chain is insufficient.' },
  { emoji: '🌶', eyebrow: 'Heat alert',    type: 'breaking', body: 'Ghost pepper wings spotted in the wild. Paramedics on standby.' },
  { emoji: '👀', eyebrow: 'Spotted',       type: 'breaking', body: 'Someone dunking in bleu cheese AND ranch simultaneously. Investigators en route.' },
  { emoji: '🛸', eyebrow: 'Unexplained',   type: 'breaking', body: "A 'mild' wing made someone cry. Science has no answers." },
  { emoji: '📊', eyebrow: 'Statistics',    type: 'fact',     body: '67% of arguments at the table are about sauce. The other 33%: bone-in.' },
  { emoji: '🎯', eyebrow: 'Fact',          type: 'fact',     body: 'The best wing is the one in front of you.' },
  { emoji: '⚡', eyebrow: 'Hot take',      type: 'fact',     body: 'The bone is not the problem. You are the problem.' },
  { emoji: '🦅', eyebrow: 'DC dispatch',   type: 'fact',     body: 'The wings of this city will not be disrespected.' },
  { emoji: '💡', eyebrow: 'Pro tip',       type: 'fact',     body: 'Order more than you think you need. You will always think wrong.' },
  { emoji: '🧠', eyebrow: 'Psychology',    type: 'fact',     body: 'Nobody has ever said "I wish I ordered fewer wings."' },
  { emoji: '📜', eyebrow: 'Law',           type: 'fact',     body: 'Every great night starts with a wing order. Verified.' },
  { emoji: '🫡', eyebrow: 'Respect',       type: 'fact',     body: 'Shoutout to everyone eating wings alone right now. Legends.' },
  { emoji: '🎭', eyebrow: 'Drama',         type: 'scene',    body: 'Someone posted their rating on main. The comments are a warzone.' },
  { emoji: '🎵', eyebrow: 'Go-go verified',type: 'scene',    body: 'These wings got the whole block moving.' },
  { emoji: '🏆', eyebrow: 'Unverified',    type: 'scene',    body: 'Someone claims to have found the perfect spot. Investigation ongoing.' },
  { emoji: '📱', eyebrow: 'Viral',         type: 'scene',    body: "Wing pic dropped. It's already in three group chats." },
  { emoji: '🌙', eyebrow: 'Late night',    type: 'scene',    body: 'The real reviews come in after midnight.' },
  { emoji: '🎪', eyebrow: 'Crawl report',  type: 'scene',    body: "Stop 3 hit different. You had to be there." },
  { emoji: '🔑', eyebrow: 'Keys',          type: 'scene',    body: "Find it. Rate it. Share it. That's the culture." },
  { emoji: '🍋', eyebrow: 'LP report',     type: 'fact',     body: 'Lemon pepper: still undefeated. Updated hourly.' },
  { emoji: '🍋', eyebrow: 'LP debate',     type: 'debate',   body: 'Wet lemon pepper vs dry. This is not a safe space.' },
  { emoji: '💀', eyebrow: 'RIP',           type: 'alert',    body: "A man ordered 'well-done' wings. We do not speak of this." },
  { emoji: '🛡️', eyebrow: 'Protection',   type: 'debate',   body: 'Ranch is not a dipping sauce. Ranch is a lifestyle. Defend it.' },
  { emoji: '🧊', eyebrow: 'Styrofoam',     type: 'fact',     body: 'Styrofoam container appreciation post. It keeps the heat. Respect it.' },
  { emoji: '🎓', eyebrow: 'Education',     type: 'fact',     body: 'Nobody leaves this platform without knowing their flavor preference. We insist.' },
  { emoji: '🏅', eyebrow: 'Recognition',   type: 'scene',    body: "Shoutout to whoever found the spot nobody's talking about yet." },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
