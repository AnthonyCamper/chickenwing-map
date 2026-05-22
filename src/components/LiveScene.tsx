import { useEffect, useRef, useState } from 'react'
import type { SpotWithReviews } from '../lib/types'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined

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

    // Pick 30 ONION headlines that rotate daily so the feed changes each day
    const today = new Date()
    const dateSeed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
    const dailyOnion = seededShuffle(ONION, dateSeed).slice(0, 30)

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

    Promise.all([
      Promise.race([redditPromise, timeout]),
      fetchAiHeadlines(),
    ]).then(([redditItems, aiItems]) => {
      const all = shuffle([...dataItems, ...timeItems, ...EVERGREEN, ...dailyOnion, ...redditItems, ...aiItems])
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

function o(body: string, eyebrow = 'Developing'): SceneItem {
  return { emoji: '📰', eyebrow, type: 'onion', body }
}

const ONION: SceneItem[] = [
  // ── Area Man / Local Woman classics ──
  o('Area Man Drives 45 Minutes For Wings, Rates 6/10, Will Return Next Week'),
  o('Local Woman Describes Wing Sauce As "Giving" — Experts Remain Baffled'),
  o('Wing Spot Receives First 10/10 Review; Owner Claims He "Knew It All Along"'),
  o('Man Who Ordered Mild Wings Still Crying, Sources Confirm'),
  o('Local Food Critic Gives Wings 4/10; Found Hiding In Witness Protection'),
  o('Area Man Insists He "Only Wanted A Few" Before Finishing 30 Wings Alone'),
  o('Local Woman\'s Review Described As "The Most Emotional Thing Posted On This Platform"'),
  o('Area Man Unable To Explain Why He Ordered Boneless; Sitting With That'),
  o('Local Teen Gives First-Ever Wing Review; Adults Nod Slowly, Say Nothing'),
  o('Area Man\'s Wing Order Described By Waitress As "A Cry For Help, But Make It Saucy"'),
  o('Local Father Rates Wings 8/10, Calls It "Pretty Good," Refuses Further Comment'),
  o('Area Woman Photographed Every Wing Before Eating; Plate Now Cold; No Regrets Expressed'),
  o('Man Seen Crying In Parking Lot Clarifies Tears Are From Happiness, Not Ghost Pepper'),
  o('Local Man\'s Wing Opinions Described As "Confidently Wrong" By Everyone At The Table'),
  o('Area Couple Disagrees On Sauce; Relationship Counselor Specializing In Wings Now Booked 6 Months Out'),
  o('Local Woman Orders Extra Ranch "For The Table" — Drinks It Alone In Bathroom'),
  o('Area Man Returns Takeout Order, Cites "Vibe Was Off"; Unable To Define Vibe'),
  o('Local Man\'s Wing Face Described By Loved Ones As "Concerning But Familiar"'),
  o('Area Woman Adds Wings To Every Occasion; Funeral Next Weekend'),
  o('Man Who Brought His Own Sauce To Wing Spot Asked To Leave, Refuses'),
  o('Local Influencer Posts Wing Photo; 47 Comments Ask Where It\'s From; She Never Responds'),
  o('Area Man Describes Himself As A "Wing Guy" Despite Only Eating Wings Four Times'),
  o('Local Restaurant Owner Spotted Watching His Own Google Reviews Refresh In Real Time'),

  // ── Nation / Study / Report ──
  o('Nation Divided After Photo Of Boneless Wings Labeled As Wings', 'Breaking'),
  o('Scientists Confirm: No Amount Of Ranch Will Fix Bad Wings', 'Study'),
  o('Study: People Who Don\'t Finish Their Wings Are A Completely Different Kind Of Person', 'Study'),
  o('Report: Man Fully Committed To Rating Wings "Tomorrow" For Past 3 Weeks', 'Report'),
  o('New Study Finds People Who Say "I\'m Not That Hungry" Are Statistically The Hungriest', 'Study'),
  o('Researchers: Those Who Order Mild And Then Steal Your Hot Wings Are A Documented Threat', 'Study'),
  o('Study Confirms Lemon Pepper Is Objectively Best; Everyone Already Knew This', 'Study'),
  o('National Wing Survey Finds 1 In 3 Americans Has Lied About Their Heat Tolerance', 'Study'),
  o('Report: Wing Sauce Described As "Not Too Spicy" By Person Currently Sweating Through Their Shirt', 'Report'),
  o('Scientists Unable To Explain Why Wings Always Taste Better After Midnight', 'Study'),
  o('Report: 94% Of People Who Say "Just One More" Are On Wing Number 7', 'Report'),
  o('Study: Finishing Your Wings And Immediately Wanting More Is Clinically Normal', 'Study'),
  o('Report: Man Who Splits An Order With You Eats 70% Of It While Looking You In The Eye', 'Report'),
  o('New Data Shows The Best Wing Spots Have The Worst Parking; Correlation Confirmed', 'Study'),
  o('CDC Issues No Warning About Wing Overconsumption; Community Takes This As Endorsement', 'Report'),
  o('Economists Baffled By Wing Spot Pricing; Customers Pay Anyway', 'Report'),
  o('Study: People Who Review Wings Immediately Are More Trustworthy In Every Area Of Life', 'Study'),
  o('Investigation Finds That "Family Size" Order Is Intended For One Person; Always Has Been', 'Report'),
  o('Research Confirms The Crunchy One At The Bottom Of The Bag Is Always The Best One', 'Study'),

  // ── Witness Protection / Legal / Government ──
  o('D.C. Man Sets Personal Record Of 47 Wings Before Questioning Life Choices', 'Breaking'),
  o('D.C. Wing Crawl Participant Has Not Been Seen Since Stop 5; Friends Unworried', 'Breaking'),
  o('Congress Unable To Agree On Wing Legislation; Bipartisan Support For Eating More', 'Breaking'),
  o('D.C. Zoning Board Approves New Wing Spot; Citizens Weep With Gratitude', 'Breaking'),
  o('Federal Reserve Raises Rates; Wing Spots Completely Unaffected, Continue Thriving', 'Report'),
  o('D.C. Council Introduces Bill To Classify Lemon Pepper As Essential Infrastructure', 'Breaking'),
  o('White House Has No Comment On Wing Rankings; Seen As Tacit Endorsement Of Top Spot', 'Report'),
  o('Local Politician Claims Wings Are "Fine"; Approval Rating Drops 12 Points', 'Breaking'),
  o('FBI Opens Investigation Into Who Touched The Last Wing Without Asking', 'Breaking'),
  o('Supreme Court Asked To Rule On Whether Boneless Wings Are Wings; Case Accepted', 'Breaking'),
  o('D.C. Mayor Photographed At Wing Spot On Campaign Trail; This Is Why She Wins', 'Report'),
  o('Senate Hearing On Wing Sauce Safety Devolves Into Everyone Just Ordering Wings', 'Breaking'),

  // ── Medical / Health ──
  o('Doctors Baffled By Man Who Ate 60 Wings And Claims To Feel "Fine, Actually"', 'Health'),
  o('ER Reports Spike In Ghost Pepper Wing Incidents; Staff Unmoved, Slightly Amused', 'Health'),
  o('Man Describes Wing-Induced Stomach Pain As "Worth It" Before Ordering More', 'Health'),
  o('Physical Therapist Notes Increase In Patients Who Hurt Themselves Reaching For Last Wing', 'Health'),
  o('Nutritionist Recommends Wings "In Moderation"; Ignored Immediately By Everyone', 'Health'),
  o('Area Man\'s Doctor Told Him To Eat Better; He Is Currently Eating Wings', 'Health'),
  o('New Weight Loss Program Eliminates All Foods Except Wings; Practitioners Report Mixed Results', 'Health'),
  o('Man Who Ate Wings Three Days In A Row Reports No Symptoms Other Than Happiness', 'Health'),
  o('Gastroenterologist Refuses To Comment On Wing Consumption; Has Wing Sauce On Shirt', 'Health'),
  o('Man\'s Hands Permanently Orange After 6 Months Of Wing Reviews; Considers It A Badge', 'Health'),

  // ── Wing Spot Culture ──
  o('Wing Spot Owner Insists "The Sauce Is The Same" Despite Widespread Community Outcry'),
  o('Man Gives Spot 7/10, Refuses To Elaborate, Leaves Town'),
  o('Group Chat Unanimously Agrees On Wing Spot; First Time In Recorded History'),
  o('Wing Spot Opens At 11am; Man Already There At 10:45; Refuses Eye Contact'),
  o('Hot Wing Challenge Completed; Participant Claims Victory Despite Visible Evidence To The Contrary'),
  o('Region\'s Foremost Wing Expert Self-Appointed; Nobody Has Challenged This'),
  o('Wing Spot With No Website, No Sign, And Suspicious Hours Has A Two-Hour Wait'),
  o('New Wing Spot Opens; Line Around The Block Day One; Owner Cries Tears Of Joy'),
  o('Wing Spot Closes Early "Due To Running Out Of Wings"; Community Devastated, Secretly Proud'),
  o('Cashier At Wing Spot Recognizes Regular; Regular Pretends Not To Notice; Both Know'),
  o('Wing Spot Menu Has 47 Options; Man Orders Same Thing He Always Gets'),
  o('Chef At Wing Spot Refuses To Reveal Sauce Recipe; Takes It To Grave In 2089'),
  o('Wing Spot\'s Yelp Page Has 3 Stars From People Who Ordered Wrong Thing; Spot Is Perfect'),
  o('Man Reviews Wing Spot He Has Never Visited; Somehow Gets It Exactly Right'),
  o('New Wing Spot Claims "Best In DC"; Residents Respect The Confidence, Verify Immediately'),
  o('Wing Spot Runs Out Of Lemon Pepper On Friday Night; City Declares State Of Emergency'),
  o('Long-Awaited Wing Spot Finally Opens; Neighborhood Shows Up As One'),

  // ── The Sauce / Flavor discourse ──
  o('Man Describes Wings As "Mid" — Crowd Goes Silent, Waiter Asks Him To Leave'),
  o('Garlic Parmesan Wing Described As "Not Really A Wing Wing" By Man Who Is Wrong'),
  o('Wing Sauce Described As "Complex" By Person Who Ordered The Mildest Option'),
  o('Lemon Pepper Wing Declared Sentient After Surviving Contact With Bleu Cheese'),
  o('New Sauce Described As "Smoky" By Person Who Has Never Experienced Smoke'),
  o('Styrofoam Container Described As "Giving The Wings Character" By Someone Wrong'),
  o('Person Who Said "I Could Make These At Home" Has Not Made Them At Home'),
  o('Dry Rub Evangelists And Wet Sauce Fundamentalists Reach Uneasy Truce; Experts Skeptical'),
  o('Man Invents New Sauce; Describes It As "Game-Changing"; It Is Buffalo With Honey In It'),
  o('Woman Claims She "Doesn\'t Really Like Saucy Wings" While Eating Sauciest Wings'),
  o('Ghost Pepper Wing Survivor Gives Interview; Still Crying; Calls It "A Religious Experience"'),
  o('Bleu Cheese Defender Wins Argument Through Sheer Exhaustion Of Opponent'),
  o('Teriyaki Wing Quietly Excellent; Receives No Credit; Continues Being Excellent'),
  o('Man Requests "Extra Crispy" Then Complains Wings Are Too Crispy; Society Loses'),
  o('Ranch Dressing Industry Posts Record Profits After Being Mentioned In Wing Context'),
  o('Hot Honey Wing Described As "Dangerous" By Person Who Has Ordered It Five Times'),
  o('Korean BBQ Wing Enters Chat; All Other Flavors Visibly Nervous'),

  // ── Social Dynamics / Friend Group ──
  o('Area Table Orders 100 Wings "To Share" — No One Sharing'),
  o('Friend Who "Isn\'t That Hungry" Eats 14 Wings, Reports No Memory Of Event'),
  o('Area Couple\'s Date Night Ruined After One Orders Well Done; Counseling Sought'),
  o('Local Man\'s Wing Rating Philosophy Takes 20 Minutes To Explain, Collapses Under Questioning'),
  o('Eleven-Wing Order Deemed "Odd Number" By Someone Who Has Clearly Never Been Hungry'),
  o('Man Returns To Same Spot 12 Times, Still Hasn\'t Tried Anything Other Than Lemon Pepper'),
  o('Local Hero Finishes Entire Order, Posts Review Immediately, Cites "Civic Duty"'),
  o('Woman Who Said "Just One More" Currently On Wing Number 19'),
  o('Takeout Order Described As "For The Table" Eaten Entirely In Car Before Arriving Home'),
  o('Man Seen Eating Wings Alone In Parking Lot At 11pm Reports He Is "Living His Best Life"'),
  o('Person Who Arrives Late To Wing Night Gets What\'s Left; Learns Valuable Lesson'),
  o('Wing Night Organizer Exhausted By Process Of Picking Wing Night Spot; Still Does It Every Week'),
  o('Man Who Always Says "I\'ll Just Have A Few" Has Never Had Just A Few'),
  o('Friend\'s "Favorite Spot" Closes; Community Rallies; Grief Is Real'),
  o('Group Of Four Orders Enough Wings For Twenty; Zero Leftovers; No Explanation Given'),
  o('Man Loses Friends Over Boneless Stance; Finds New Friends; They Share His Values'),
  o('Woman Sends Wing Photo To Group Chat At 1am; Everyone Responds Immediately'),
  o('Designated Driver At Wing Night Eats More Wings Than Anyone; No One Questions It'),

  // ── Crawl-specific ──
  o('Wing Crawl Stop 4 Described As "Where The Night Changed" By All Who Were Present', 'Crawl Report'),
  o('Crawl Participant Calls In Sick Next Day, Cites "Residual Wing Energy"', 'Crawl Report'),
  o('Wing Crawl Itinerary Ignored By Minute 12; Everyone Agrees It Was Better That Way', 'Crawl Report'),
  o('Man Who Said He\'d "Just Try A Few At Each Stop" Hospitalizes Himself With Dignity', 'Crawl Report'),
  o('This Year\'s Wing Crawl Already Being Called "Legendary" By People Still In It', 'Crawl Report'),
  o('Crawl Veteran Arrives With Own Wet Wipes; Group Elects Her President', 'Crawl Report'),
  o('Last Stop On Wing Crawl Hits Hardest; Scientists Call It "The Final Form"', 'Crawl Report'),
  o('Wing Crawl Group Photo Taken; Everyone Has Sauce On Their Face; Photo Is Perfect', 'Crawl Report'),
  o('Crawl Participant Who "Wasn\'t Sure About This" Now Planning Next Crawl', 'Crawl Report'),
  o('Someone Orders A Salad At Stop 3 Of The Wing Crawl; Nobody Speaks To Them Again', 'Crawl Report'),

  // ── Existential / Philosophical ──
  o('Man Stares At Last Wing On Plate For 4 Minutes Before Eating It; Reports It Was The Right Call'),
  o('Wing Eaten At 2am Hits Completely Different; Physicists Have No Explanation'),
  o('First Bite Always The Best; Man Spends Career Trying To Recreate It; Fails; Orders More'),
  o('Wing Philosopher Asks: If The Sauce Is The Same But The Wing Spot Changed, Is It The Same Wing?'),
  o('Man Considers Ordering Something Different; Does Not; Reports No Regrets'),
  o('Question Raised Whether The Perfect Wing Exists; Question Answered With More Wings'),
  o('Wing That Got Away Still Haunts Man Three Years Later; He Can Describe It Exactly'),
  o('Man Who Ate Wings Every Week For A Year Reports It "Never Got Old"; Continues'),
  o('The Hunt For The Perfect Wing Described As "The Most Meaningful Thing I Do"'),
  o('Wing Expert Admits There Is Always A Better Wing Somewhere; This Is What Keeps Him Going'),

  // ── Rating system discourse ──
  o('Man Gives 10/10; Immediately Starts Looking For Better; This Is The Wing Condition'),
  o('7/10 Review Posted; Author Demands To Know Who Hurt Reviewer; No Response'),
  o('Wing Rating Scale 1-10 Described As "The Only Measurement That Matters" By Local Man'),
  o('Person Who Gives Everything 5/10 Asked To Leave Platform; They Remain'),
  o('First Review Of New Spot Comes In At 9/10; Owner Immediately Wants To Know What Was Wrong'),
  o('Man Gives Wings 10/10 Then Refuses To Name Spot; Considered A War Criminal'),
  o('Review Posted With Zero Stars; Turns Out Reviewer Ordered Wrong Thing; Stars Remain'),
  o('Anonymous Review Gives 3/10; Handwriting Recognized; Town Meeting Called'),
  o('Man Changes Rating From 8 To 9 After Reflecting; Spot Owner Cries'),

  // ── Late night / after hours ──
  o('Wings Ordered At 1:47am Arrive Hot; Man Considers This A Miracle', 'Late Night'),
  o('Last Kitchen Still Open In A 5-Mile Radius Does Wings; Area Man Calls This "Perfect Urban Planning"', 'Late Night'),
  o('Late Night Wing Order Described As "The Best Decision I\'ve Made This Year"', 'Late Night'),
  o('Man Discovers Wing Spot Open At 3am; Tells No One; This Is His Spot Now', 'Late Night'),
  o('After-Midnight Wing Review Posted; Most Emotional Review On The Platform', 'Late Night'),
  o('Night Shift Worker Reviews Wings At 4am; Review Is Haunting; Also Correct', 'Late Night'),
  o('Wing Spot That Closes At 2am Does Not Know The Power It Has', 'Late Night'),
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

// ─── AI headline generation ───────────────────────────────────────────────────

const PROMPT_PERSONAL = `You write satirical headlines for WingMap, a Washington DC chicken wing review app live ticker. Generate exactly 50 headlines.

MATCH THIS STYLE EXACTLY — study these examples before writing:
Area Man Drives 45 Minutes For Wings, Rates 6/10, Will Return Next Week
Local Woman Describes Wing Sauce As "Giving" — Experts Remain Baffled
Area Man Insists He "Only Wanted A Few" Before Finishing 30 Wings Alone
Local Woman's Review Described As "The Most Emotional Thing Posted On This Platform"
Area Woman Photographed Every Wing Before Eating; Plate Now Cold; No Regrets Expressed
Area Couple Disagrees On Sauce; Relationship Counselor Specializing In Wings Now Booked 6 Months Out
Man Seen Crying In Parking Lot Clarifies Tears Are From Happiness, Not Ghost Pepper
Local Influencer Posts Wing Photo; 47 Comments Ask Where It's From; She Never Responds
Report: Man Who Splits An Order With You Eats 70% Of It While Looking You In The Eye
Study Confirms Lemon Pepper Is Objectively Best; Everyone Already Knew This
Scientists Unable To Explain Why Wings Always Taste Better After Midnight
Report: 94% Of People Who Say "Just One More" Are On Wing Number 7
Takeout Order Described As "For The Table" Eaten Entirely In Car Before Arriving Home
Man Stares At Last Wing On Plate For 4 Minutes Before Eating It; Reports It Was The Right Call
Wing Crawl Stop 4 Described As "Where The Night Changed" By All Who Were Present
Crawl Participant Calls In Sick Next Day, Cites "Residual Wing Energy"
Area Woman Adds Wings To Every Occasion; Funeral Next Weekend

WHAT MAKES THESE WORK — follow all three rules:
1. SPECIFIC NUMBERS. "45 minutes" not "a long time." "6/10" not "mediocre." "70%" not "most." "4 minutes" not "a while." "47 comments" not "many." Numbers are the joke.
2. THE BUTTON. The second half undercuts the first in a deadpan way: ", Will Return Next Week" / "; Everyone Already Knew This" / "; No Regrets Expressed" / "; She Never Responds." The button is everything.
3. TREAT IT LIKE REAL NEWS. Internal quotes, clinical language, sourced observations. "Sources Confirm." "Experts Remain Baffled." "Reports It Was The Right Call." "Sitting With That."

COVER THESE (approximately):
- Area Man / Local Woman personal situations (18 headlines): irrational loyalty, ordering wrong thing, group dynamics, parking lot eating, regret-free overconsumption
- Study / Report / Scientists / Doctors (12 headlines): fake research confirming obvious things or finding absurd conclusions about wing behavior
- Late Night / Crawl (10 headlines): specific stop numbers, next-day consequences, the parking lot at 11pm, the group chat at 1am
- Sauce and flavor debates (10 headlines): lemon pepper supremacy, bleu cheese vs ranch civil war, garlic parm discourse, dry rub vs wet, mumbo sauce
- Wing spot culture (10 headlines): the spot with no sign that has a two-hour wait, owners watching reviews refresh, running out of the good stuff on Friday

DC GEOGRAPHY to drop naturally: Columbia Heights, H Street, Shaw, U Street, Adams Morgan, The Wharf, Nationals Park, WMATA

OUTPUT: one headline per line, no numbers, no bullets, no quotes around full headline, 50–115 characters, title case, nothing else`

const PROMPT_PUBLIC = `You write satirical headlines for WingMap, a Washington DC chicken wing review app live ticker. Generate exactly 50 headlines.

MATCH THIS STYLE EXACTLY — study these examples before writing:
D.C. Council Introduces Bill To Classify Lemon Pepper As Essential Infrastructure
Congress Unable To Agree On Wing Legislation; Bipartisan Support For Eating More
FBI Opens Investigation Into Who Touched The Last Wing Without Asking
Supreme Court Asked To Rule On Whether Boneless Wings Are Wings; Case Accepted
Federal Reserve Raises Rates; Wing Spots Completely Unaffected, Continue Thriving
White House Has No Comment On Wing Rankings; Seen As Tacit Endorsement Of Top Spot
D.C. Mayor Photographed At Wing Spot On Campaign Trail; This Is Why She Wins
Senate Hearing On Wing Sauce Safety Devolves Into Everyone Just Ordering Wings
CDC Issues No Warning About Wing Overconsumption; Community Takes This As Endorsement
D.C. Zoning Board Approves New Wing Spot; Citizens Weep With Gratitude
Nation Divided After Photo Of Boneless Wings Labeled As Wings
Local Politician Claims Wings Are "Fine"; Approval Rating Drops 12 Points
Economists Baffled By Wing Spot Pricing; Customers Pay Anyway
National Wing Survey Finds 1 In 3 Americans Has Lied About Their Heat Tolerance

WHAT MAKES THESE WORK — follow all three rules:
1. INSTITUTIONAL LANGUAGE applied to wings. FBI investigations. Congressional hearings. CDC advisories. Federal Reserve statements. Supreme Court dockets. The joke is the mismatch between the institution's gravity and the subject.
2. THE IRONIC PIVOT. The second clause lands the joke: "; Bipartisan Support For Eating More" / "; Community Takes This As Endorsement" / "; Customers Pay Anyway" / "; This Is Why She Wins."
3. REAL CURRENT EVENTS filtered through wings. Take actual news — AI replacing jobs, tech layoffs, housing costs, DEI rollbacks, government efficiency initiatives, social media drama, crypto — and reframe it as a wing culture story. Make it feel ripped from today's headlines but about wings.

COVER THESE (approximately):
- DC Government / Political (15 headlines): D.C. Council, Congress, the Mayor, DDOT, zoning boards, Metro/WMATA, local elections — all about wings
- Federal / National institutions (10 headlines): FBI, CIA, Supreme Court, CDC, Federal Reserve, Pentagon, White House, Smithsonian
- Current events reframed as wing news (15 headlines): AI taking over wing reviews, tech layoffs sending workers to wing spots, housing costs making wing spots the last affordable thing in DC, government efficiency cuts affecting wing spot inspections, social media algorithms burying the best spots
- Nation / Breaking (10 headlines): national polls, cross-state comparisons, cultural divides, international wing diplomacy
- Sports and culture (5 headlines): Commanders game day, Nationals post-game wings, go-go music and wing spots, DC United tailgate

DC GEOGRAPHY: Capitol Hill, Foggy Bottom, Georgetown, Anacostia, NoMa, Brookland, Petworth, Silver Spring, Pentagon City

OUTPUT: one headline per line, no numbers, no bullets, no quotes around full headline, 50–115 characters, title case, nothing else`

function classifyLine(text: string): { eyebrow: string; type: ChipType } {
  const t = text.toLowerCase()
  if (t.match(/\bstudy\b|\bscientists?\b|\bresearch(ers?)?\b|\bdoctors?\b/))
    return { eyebrow: 'Study', type: 'fact' }
  if (t.match(/^report:|^report,|\bsources? confirm\b|\bdata show/))
    return { eyebrow: 'Report', type: 'internet' }
  if (t.match(/\bd\.c\.\b|\bcongress\b|\bsenate\b|\bfbi\b|\bwhite house\b|\bsupreme court\b|\bpentagon\b|\bfederal \b|\bpresident\b|\bmayor\b|\bcouncil\b/))
    return { eyebrow: 'Breaking', type: 'breaking' }
  if (t.match(/\bnation\b|\bnational\b|\bamericans?\b/))
    return { eyebrow: 'Nation', type: 'breaking' }
  if (t.match(/crawl|stop [0-9]/))
    return { eyebrow: 'Crawl Report', type: 'scene' }
  if (t.match(/doctor|health|hospital|\bcdc\b|nurse|er report/))
    return { eyebrow: 'Health', type: 'alert' }
  if (t.match(/midnight|late night|\b[12]am\b|after midnight|night shift/))
    return { eyebrow: 'Late Night', type: 'scene' }
  if (t.match(/\bai\b|artificial intelligence|tech |layoff|economy|housing|crypto|algorithm/))
    return { eyebrow: 'Developing', type: 'internet' }
  return { eyebrow: 'Developing', type: 'onion' }
}

async function callGemini(prompt: string): Promise<SceneItem[]> {
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.2, maxOutputTokens: 2048 },
        }),
      }
    )
    clearTimeout(tid)
    if (!res.ok) return []
    const data = await res.json()
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return text
      .split('\n')
      .map((l: string) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
      .filter((l: string) => l.length > 30 && l.length < 120)
      .map((headline: string) => {
        const { eyebrow, type } = classifyLine(headline)
        return { emoji: '📰', eyebrow, body: headline, type }
      })
  } catch {
    clearTimeout(tid)
    return []
  }
}

async function fetchAiHeadlines(): Promise<SceneItem[]> {
  if (!GEMINI_KEY) return []

  const today = new Date().toISOString().split('T')[0]
  const cacheKey = `ai_headlines_v2_${today}`

  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) return JSON.parse(cached) as SceneItem[]
  } catch {}

  // Two parallel calls — personal/community stories + public/political/current events
  const [personal, political] = await Promise.all([
    callGemini(PROMPT_PERSONAL),
    callGemini(PROMPT_PUBLIC),
  ])

  const items = [...personal, ...political]

  if (items.length > 0) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(items))
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('ai_headlines_') && k !== cacheKey) localStorage.removeItem(k)
      }
    } catch {}
  }

  return items
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Deterministic daily shuffle — same seed produces same order
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), s | 1)
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61)
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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
