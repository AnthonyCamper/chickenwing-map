import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { formatVisitDate } from '../lib/dates'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { deleteCrawl, toggleCrawlLike } from '../lib/crawlActions'
import { directionsUrl, loadCrawlCheckoffs, saveCrawlCheckoffs } from '../lib/crawlUtils'
import AppHeader from '../components/AppHeader'
import { useAuthContext } from '../components/AuthProvider'
import PageStateShell from '../components/ui/PageStateShell'
import PhotoLightbox from '../components/ui/PhotoLightbox'
import AvatarImage from '../components/ui/AvatarImage'
import CrawlRouteMap from '../components/ui/CrawlRouteMap'
import CrawlOwnerToolbar from '../components/ui/CrawlOwnerToolbar'
import ShareButton from '../components/ui/ShareButton'
import HeartIcon from '../components/gallery/HeartIcon'
import CrawlCommentThread from '../components/CrawlCommentThread'
import { useAuthGate } from '../components/AuthGateModal'
import { useDragCarousel } from '../components/gallery/useDragCarousel'
import type { WingCrawlDetailed, WingCrawlItem, WingSpot } from '../lib/types'
import { isUuid } from '../lib/reviewActions'
import { cleanUserText } from '../lib/userText'
import { formatRating } from '../lib/formatRating'
import CrawlCoverCollage from '../components/ui/CrawlCoverCollage'

interface SpotPhoto { id: string; url: string }

interface SpotReview {
  id: string
  overall_rating: number
  wing_flavor: string | null
  review_text: string | null
  visited_at: string
  reviewer_name: string | null
  reviewer_avatar: string | null
}

interface ItemWithSpot extends WingCrawlItem {
  spot: WingSpot | null
  spot_photos: SpotPhoto[]
  spot_avg_rating: number | null
  spot_review_count: number
  spot_reviews: SpotReview[]
  /** The signed-in viewer has reviewed this spot (counts as visited). */
  reviewed_by_me: boolean
}

interface CrawlDetail {
  crawl: WingCrawlDetailed
  items: ItemWithSpot[]
  isOwner: boolean
}

export default function CrawlPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<CrawlDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading')
  const [likeBusy, setLikeBusy] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [lightbox, setLightbox] = useState<{ photos: SpotPhoto[]; index: number } | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const { requireAuth } = useAuthGate()
  const auth = useAuthContext()

  const load = useCallback(async () => {
    if (!slug) return
    setStatus('loading')

    // /lists/<uuid> links (e.g. built from a list id) resolve too, not just slugs.
    const { data: crawl, error: crawlErr } = await supabase
      .from('wing_crawls_detailed')
      .select('*')
      .eq(isUuid(slug) ? 'id' : 'slug', slug)
      .maybeSingle()

    if (crawlErr) { setStatus('error'); return }
    if (!crawl) { setStatus('not-found'); return }

    const { data: { session } } = await supabase.auth.getSession()
    const viewerId = session?.user?.id ?? ''
    const isOwner = viewerId === (crawl as WingCrawlDetailed).user_id
    setCurrentUserId(viewerId)

    const { data: rawItems } = await supabase
      .from('wing_crawl_items')
      .select('*')
      .eq('crawl_id', (crawl as WingCrawlDetailed).id)
      .order('position', { ascending: true })

    const itemList = (rawItems ?? []) as WingCrawlItem[]
    const spotIds = itemList.map(i => i.wing_spot_id)

    let spotsById: Record<string, WingSpot> = {}
    let ratingsBySpot: Record<string, { avg: number; count: number }> = {}
    let photosBySpot: Record<string, SpotPhoto[]> = {}
    let reviewsBySpot: Record<string, SpotReview[]> = {}
    const reviewedByMe = new Set<string>()

    if (spotIds.length > 0) {
      const [{ data: spots }, { data: reviews }] = await Promise.all([
        supabase.from('wing_spots').select('*').in('id', spotIds),
        supabase
          .from('reviews_with_profiles')
          .select('id, wing_spot_id, user_id, overall_rating, wing_flavor, review_text, visited_at, reviewer_name, reviewer_avatar')
          .in('wing_spot_id', spotIds)
          .order('visited_at', { ascending: false }),
      ])

      for (const s of (spots ?? []) as WingSpot[]) spotsById[s.id] = s

      const groups: Record<string, number[]> = {}
      const reviewToSpot: Record<string, string> = {}
      type RawReview = { id: string; wing_spot_id: string; user_id: string | null; overall_rating: number; wing_flavor: string | null; review_text: string | null; visited_at: string; reviewer_name: string | null; reviewer_avatar: string | null }
      for (const r of (reviews ?? []) as RawReview[]) {
        if (!groups[r.wing_spot_id]) groups[r.wing_spot_id] = []
        groups[r.wing_spot_id].push(r.overall_rating)
        reviewToSpot[r.id] = r.wing_spot_id
        if (viewerId && r.user_id === viewerId) reviewedByMe.add(r.wing_spot_id)
        if (!reviewsBySpot[r.wing_spot_id]) reviewsBySpot[r.wing_spot_id] = []
        if (reviewsBySpot[r.wing_spot_id].length < 3) {
          reviewsBySpot[r.wing_spot_id].push({
            id: r.id,
            overall_rating: r.overall_rating,
            wing_flavor: r.wing_flavor,
            review_text: r.review_text,
            visited_at: r.visited_at,
            reviewer_name: r.reviewer_name,
            reviewer_avatar: r.reviewer_avatar,
          })
        }
      }
      for (const [sid, ratings] of Object.entries(groups)) {
        const sum = ratings.reduce((a, b) => a + b, 0)
        ratingsBySpot[sid] = { avg: sum / ratings.length, count: ratings.length }
      }

      const allReviewIds = Object.keys(reviewToSpot)
      if (allReviewIds.length > 0) {
        const { data: photos } = await supabase
          .from('review_photos')
          .select('id, review_id, url, display_order')
          .in('review_id', allReviewIds)
          .order('display_order', { ascending: true })

        for (const p of (photos ?? []) as { id: string; review_id: string; url: string }[]) {
          const sid = reviewToSpot[p.review_id]
          if (!sid) continue
          if (!photosBySpot[sid]) photosBySpot[sid] = []
          if (photosBySpot[sid].length < 6) {
            photosBySpot[sid].push({ id: p.id, url: p.url })
          }
        }
      }
    }

    const items: ItemWithSpot[] = itemList.map(it => ({
      ...it,
      spot: spotsById[it.wing_spot_id] ?? null,
      spot_avg_rating: ratingsBySpot[it.wing_spot_id]?.avg ?? null,
      spot_review_count: ratingsBySpot[it.wing_spot_id]?.count ?? 0,
      spot_photos: photosBySpot[it.wing_spot_id] ?? [],
      spot_reviews: reviewsBySpot[it.wing_spot_id] ?? [],
      reviewed_by_me: reviewedByMe.has(it.wing_spot_id),
    }))

    setData({ crawl: crawl as WingCrawlDetailed, items, isOwner })
    setStatus('ready')
  }, [slug])

  useEffect(() => { load() }, [load])

  // On-crawl check-offs are local to this device (no account needed).
  useEffect(() => {
    if (data) setCheckedIds(loadCrawlCheckoffs(data.crawl.id))
  }, [data?.crawl.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleChecked(itemId: string) {
    if (!data) return
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      saveCrawlCheckoffs(data.crawl.id, next)
      return next
    })
  }

  async function handleToggleLike() {
    if (!data) return
    if (!requireAuth()) return
    if (likeBusy) return

    setLikeBusy(true)
    const wasLiked = data.crawl.is_liked_by_me
    setData({
      ...data,
      crawl: {
        ...data.crawl,
        is_liked_by_me: !wasLiked,
        like_count: data.crawl.like_count + (wasLiked ? -1 : 1),
      },
    })

    const { error } = await toggleCrawlLike(data.crawl.id, currentUserId, wasLiked)
    if (error) {
      setData(d => d ? {
        ...d,
        crawl: {
          ...d.crawl,
          is_liked_by_me: wasLiked,
          like_count: d.crawl.like_count + (wasLiked ? 1 : -1),
        },
      } : d)
      toast.error('Could not update like')
    }
    setLikeBusy(false)
  }

  async function handleDelete() {
    if (!data) return
    const { error } = await deleteCrawl(data.crawl.id)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('List deleted')
    if (data.crawl.author_username) navigate(`/u/${data.crawl.author_username}`)
    else navigate('/')
  }

  if (status === 'loading') {
    // Same shape as the loaded page (cover, title, byline, first rows) so
    // there's something to look at on slow 3G and nothing jumps after.
    return (
      <div className="min-h-dvh bg-paper">
        <AppHeader />
        <div className="animate-pulse" role="status">
          <span className="sr-only">Loading list…</span>
          <div className="border-b-2 border-night-900 bg-cream-100">
            <div aria-hidden="true" className="w-full h-48 sm:h-64 bg-cream-200" />
            <div className="max-w-3xl mx-auto px-5 py-6">
              <div aria-hidden="true" className="h-3 w-16 rounded bg-cream-200 mb-3" />
              <div aria-hidden="true" className="h-9 w-3/4 rounded bg-cream-200" />
              <div aria-hidden="true" className="flex items-center gap-3 mt-5">
                <div className="w-8 h-8 rounded-full bg-cream-200" />
                <div className="h-3 w-40 rounded bg-cream-200" />
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto px-5 py-8 space-y-3">
            <div aria-hidden="true" className="h-48 sm:h-56 rounded-2xl bg-cream-200" />
            {[0, 1].map(i => (
              <div key={i} aria-hidden="true" className="h-28 rounded-xl border-2 border-cream-200 bg-cream-50" />
            ))}
            <p className="pt-2 text-center font-display uppercase tracking-crowd text-sm text-night-700">Loading list…</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <PageStateShell title="List not found — WingKingTony">
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">List not found</h1>
        <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
          This list doesn't exist, was deleted, or is private.
        </p>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  if (status === 'error' || !data) {
    return (
      <PageStateShell>
        <h1 className="font-display uppercase text-3xl text-night-900">Couldn't load this list</h1>
        <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
          Check your connection and try again.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => load()} className="btn-primary">Try again</button>
          <Link to="/" className="btn-secondary">Back home</Link>
        </div>
      </PageStateShell>
    )
  }

  const { crawl, items, isOwner } = data
  const isVisited = (i: ItemWithSpot) => i.reviewed_by_me || checkedIds.has(i.id)
  const allItemPhotos = items.flatMap(i => i.spot_photos.map(p => p.url))
  const coverPhoto = crawl.cover_image_url ?? allItemPhotos[0] ?? null
  const gridPhotos = !crawl.cover_image_url ? allItemPhotos.slice(0, 4) : []
  const authorPrivate = crawl.author_is_private
  const authorLinkable = !authorPrivate && crawl.author_username
  const title = cleanUserText(crawl.title)
  // The view already masks a private author's name for everyone else; show
  // that in plain words rather than the view's "Private wing-logger".
  const authorName = authorPrivate && !isOwner
    ? 'Private member'
    : cleanUserText(crawl.author_name) || 'Unknown'
  const description = crawl.description?.trim()
    ? crawl.description.trim().slice(0, 200)
    : `${crawl.item_count} wing ${crawl.item_count === 1 ? 'spot' : 'spots'} curated by ${crawl.author_name ?? 'a member'} on WingKingTony.`

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{`${title} — WingKingTony`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${title} — WingKingTony`} />
        <meta property="og:description" content={description} />
        {coverPhoto && <meta property="og:image" content={coverPhoto} />}
        <meta property="og:type" content="article" />
        <link rel="canonical" href={`${typeof window !== 'undefined' ? window.location.origin : 'https://wingkingtony.com'}/lists/${crawl.slug}`} />
      </Helmet>

      <AppHeader />

      {isOwner && (
        <CrawlOwnerToolbar
          mode="view"
          viewHref={`/lists/${crawl.slug}`}
          editHref={`/lists/${crawl.id}/edit`}
          onDelete={handleDelete}
        />
      )}

      <header className="border-b-2 border-night-900 bg-cream-100">
        {/* Cover */}
        {crawl.cover_image_url ? (
          <button
            type="button"
            onClick={() => setLightbox({ photos: [{ id: 'cover', url: crawl.cover_image_url! }], index: 0 })}
            aria-label="View cover photo full screen"
            className="block w-full h-48 sm:h-64 bg-night-900 overflow-hidden cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sauce-400"
          >
            <img src={crawl.cover_image_url} alt="" className="w-full h-full object-cover" />
          </button>
        ) : gridPhotos.length > 0 ? (
          <CrawlCoverCollage photos={gridPhotos} className="w-full h-48 sm:h-64" />
        ) : null}

        <div className="max-w-3xl mx-auto px-5 py-6">
          <p className="eyebrow mb-2">
            {crawl.is_ranked ? 'Ranked list' : 'List'}
            {!crawl.is_public && ' · Private'}
          </p>
          <h1 className="user-text font-display uppercase text-4xl md:text-5xl text-night-900 leading-none tracking-tightest break-words">
            {title}
          </h1>
          {crawl.description && (
            <p className="user-text text-sm text-charcoal-700 mt-3 max-w-prose whitespace-pre-wrap break-words">{cleanUserText(crawl.description)}</p>
          )}

          <div className="flex items-center gap-3 mt-5">
            <AvatarImage
              src={crawl.author_avatar}
              alt=""
              className="w-8 h-8 flex-shrink-0 rounded-full border-2 border-night-900 object-cover"
              fallback={
                <div className="w-8 h-8 flex-shrink-0 rounded-full border-2 border-night-900 bg-cream-200 flex items-center justify-center text-xs font-bold text-night-900">
                  {authorName.charAt(0).toUpperCase()}
                </div>
              }
            />
            {/* Wraps onto a second line instead of truncating: an 11-letter
                name used to show as "by THUMB …" next to Like and Share */}
            <p className="text-xs min-w-0 flex-1 leading-snug line-clamp-2 break-words">
              <span className="text-charcoal-500">by </span>
              {authorLinkable ? (
                // py/-my: 44px tall tap area without changing the line height
                <Link to={`/u/${crawl.author_username}`} className="user-text py-3 -my-3 font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors">
                  {authorName}
                </Link>
              ) : (
                <span className="user-text font-extrabold uppercase tracking-crowd text-night-800">{authorName}</span>
              )}
              <span className="text-charcoal-400 whitespace-nowrap"> · {crawl.item_count} {crawl.item_count === 1 ? 'spot' : 'spots'}</span>
            </p>

            <button
              onClick={handleToggleLike}
              disabled={likeBusy}
              aria-label={crawl.is_liked_by_me ? 'Unlike list' : 'Like list'}
              className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] justify-center -my-2 px-2 text-charcoal-500 hover:text-sauce-500 transition-colors disabled:opacity-50"
            >
              <HeartIcon filled={crawl.is_liked_by_me} className="w-5 h-5" />
              {crawl.like_count > 0 && (
                <span className="text-xs font-bold">{crawl.like_count}</span>
              )}
            </button>
            {crawl.is_public ? (
              <ShareButton
                title={title}
                text={description}
                url={`${window.location.origin}/lists/${crawl.slug}`}
                className="flex-shrink-0 inline-flex items-center gap-1.5 min-h-[44px] -my-2 px-2 text-sm text-charcoal-500 hover:text-sauce-500 transition-colors"
              />
            ) : (
              // Only the owner can see a private list — don't offer a share
              // link that 404s for everyone else; route to the toggle instead.
              <Link
                to={`/lists/${crawl.id}/edit`}
                title="This list is private — only you can see it. Make it public to share."
                className="inline-flex items-center gap-1.5 min-h-[44px] -my-2 px-2 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:text-sauce-500 transition-colors"
              >
                🔒 Private
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-safe-fab">
        {items.length > 0 && (
          <div className="mb-6">
            <CrawlRouteMap
              items={items}
              onSelectSpot={(spot) => { if (spot.slug) navigate(`/spots/${spot.slug}`) }}
            />
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-charcoal-500 text-sm italic">
            No spots yet.{isOwner && (
              <> <Link to={`/lists/${crawl.id}/edit`} className="text-sauce-500 hover:underline">Add some →</Link></>
            )}
          </p>
        ) : (
          <>
            {/* Visit progress: device-local check-offs, plus every spot the
                signed-in viewer has already reviewed (m2 S10) */}
            <div className="card-soft px-4 py-3 mb-4 flex items-center gap-3">
              {/* Saved on this device only; plain words (not "on the crawl") */}
              <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 shrink-0">Visited</span>
              <div className="flex-1 h-2 bg-cream-200 rounded-full overflow-hidden border border-night-900/20">
                <div
                  className="h-full bg-sauce-400 transition-all duration-500"
                  style={{ width: `${Math.round((items.filter(isVisited).length / items.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-sauce-500 shrink-0">
                {items.filter(isVisited).length}/{items.length}
              </span>
            </div>
            <ol className="space-y-3">
              {items.map((it, idx) => (
                <li key={it.id}>
                  <CrawlItemRow
                    item={it}
                    position={idx + 1}
                    ranked={crawl.is_ranked}
                    checked={checkedIds.has(it.id)}
                    reviewed={it.reviewed_by_me}
                    onToggleChecked={() => toggleChecked(it.id)}
                    onPhotoClick={(photoIdx) => setLightbox({ photos: it.spot_photos, index: photoIdx })}
                  />
                </li>
              ))}
            </ol>
          </>
        )}

        {/* Comments */}
        <section className="mt-10 pt-6 border-t-2 border-night-900/10">
          <h2 className="eyebrow mb-3">Comments</h2>
          <CrawlCommentThread
            crawlId={crawl.id}
            currentUserId={currentUserId}
            isAdmin={auth?.isAdmin ?? false}
          />
        </section>
      </main>

      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}

function CrawlItemRow({
  item, position, ranked, checked, reviewed, onToggleChecked, onPhotoClick,
}: {
  item: ItemWithSpot
  position: number
  ranked: boolean
  checked: boolean
  reviewed: boolean
  onToggleChecked: () => void
  onPhotoClick: (index: number) => void
}) {
  const { spot, spot_photos: photos, spot_reviews: reviews } = item
  if (!spot) {
    return (
      <div className="bg-cream-50 border-2 border-night-900 rounded-xl p-4 shadow-sticker">
        <p className="text-sm text-charcoal-500 italic">Spot removed.</p>
      </div>
    )
  }

  // The map numbers every pin, so the list numbers every row too — ranked
  // just changes the styling from itinerary-neutral to top-N loud.
  const header = (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-10 h-10 rounded-full border-2 border-night-900 flex items-center justify-center font-display text-lg shadow-sticker-sm ${
        ranked ? 'bg-sauce-400 text-night-900' : 'bg-cream-200 text-night-800'
      }`}>
        {position}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display uppercase text-lg text-night-900 truncate tracking-tightest">{spot.name}</p>
            <p className="text-xs text-charcoal-500 truncate">{spot.address}</p>
          </div>
          {item.spot_avg_rating != null && (
            <div className="flex items-center gap-1 px-2 py-1 bg-cream-100 border-2 border-night-900 rounded shrink-0">
              <span className="font-display text-sm text-night-900">{formatRating(item.spot_avg_rating)}</span>
              <span className="text-[10px] uppercase font-bold tracking-crowd text-charcoal-500">/10</span>
            </div>
          )}
        </div>
        {item.note && (
          <p className="user-text text-sm text-charcoal-700 mt-2 italic whitespace-pre-wrap break-words">"{cleanUserText(item.note)}"</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker overflow-hidden">
      {/* Header — links to spot when it has a page (no dead '#' links) */}
      {spot.slug ? (
        <Link to={`/spots/${spot.slug}`} className="block p-4 hover:bg-cream-100/50 transition-colors">
          {header}
        </Link>
      ) : (
        <div className="p-4">{header}</div>
      )}

      {/* On-crawl actions */}
      <div className="border-t-2 border-night-900/10 px-4 py-2 flex items-center gap-2">
        {reviewed ? (
          // You've reviewed it, so you've been: no need to tick it off.
          <span className="min-h-[44px] px-3 inline-flex items-center rounded-xl border-2 bg-gold-100 border-gold-300 text-gold-700 text-xs font-extrabold uppercase tracking-crowd">
            ✓ Reviewed
          </span>
        ) : (
        <button
          type="button"
          onClick={onToggleChecked}
          aria-pressed={checked}
          className={`min-h-[44px] px-3 rounded-xl border-2 text-xs font-extrabold uppercase tracking-crowd transition-colors ${
            checked
              ? 'bg-gold-100 border-gold-300 text-gold-700'
              : 'bg-cream-50 border-night-900/20 text-charcoal-500 hover:border-sauce-400'
          }`}
        >
          {checked ? '✓ Visited' : 'Mark as visited'}
        </button>
        )}
        {spot.lat != null && spot.lng != null && (
          <a
            href={directionsUrl(spot.lat, spot.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3 inline-flex items-center rounded-xl border-2 border-night-900/20 text-xs font-extrabold uppercase tracking-crowd text-charcoal-500 hover:border-sauce-400 hover:text-sauce-500 transition-colors"
          >
            Directions ↗
          </a>
        )}
      </div>

      {/* Photos — full-width swipeable carousel; the whole photo stays visible
          (object-contain), tapping opens the lightbox for full-screen */}
      {photos.length > 0 && (
        <CrawlItemPhotoCarousel
          photos={photos}
          spotName={spot.name}
          seeAllHref={spot.slug ? `/spots/${spot.slug}` : null}
          onPhotoClick={onPhotoClick}
        />
      )}

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className="border-t-2 border-night-900/10 divide-y divide-night-900/8">
          {reviews.map(r => {
            const dateStr = formatVisitDate(r.visited_at)
            const name = cleanUserText(r.reviewer_name) || 'Anonymous'
            const initials = name.charAt(0).toUpperCase()
            return (
              <Link key={r.id} to={`/reviews/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-cream-100/50 transition-colors">
                <div className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-night-900 bg-night-700 flex items-center justify-center overflow-hidden">
                  <AvatarImage
                    src={r.reviewer_avatar}
                    alt={name}
                    className="w-full h-full object-cover"
                    fallback={<span className="text-[10px] font-extrabold text-cream-50 uppercase">{initials}</span>}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="user-text min-w-0 max-w-full truncate text-xs font-extrabold uppercase tracking-crowd text-night-800">{name}</span>
                    <span className="font-display text-sm text-sauce-500">{Number(r.overall_rating).toFixed(1)}<span className="text-[10px] text-charcoal-400">/10</span></span>
                    {r.wing_flavor && <span className="min-w-0 max-w-full truncate text-[11px] text-charcoal-500">{r.wing_flavor}</span>}
                    <span className="text-[10px] text-charcoal-400 ml-auto">{dateStr}</span>
                  </div>
                  {r.review_text && (
                    <p className="user-text text-xs text-charcoal-600 mt-0.5 line-clamp-2 leading-relaxed break-words">{cleanUserText(r.review_text)}</p>
                  )}
                </div>
              </Link>
            )
          })}
          {item.spot_review_count > reviews.length && spot.slug && (
            <Link
              to={`/spots/${spot.slug}`}
              className="block px-4 py-2.5 text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:bg-cream-100/50 transition-colors"
            >
              See all {item.spot_review_count} reviews →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function CrawlItemPhotoCarousel({
  photos, spotName, seeAllHref, onPhotoClick,
}: {
  photos: SpotPhoto[]
  spotName: string
  seeAllHref: string | null
  onPhotoClick: (index: number) => void
}) {
  const [index, setIndex] = useState(0)
  const { containerProps, trackStyle } = useDragCarousel(photos.length, index, setIndex)

  return (
    <div
      className="relative border-t-2 border-night-900/10 aspect-[4/3] bg-night-900 overflow-hidden touch-pan-y"
      {...(photos.length > 1 ? containerProps : {})}
    >
      {/* The track's inline `transform` creates a stacking context; the open
          button stays clickable only because it follows the track in DOM
          order — don't reorder (same pattern as ReviewFeedCard). */}
      <div className="flex h-full w-full" style={photos.length > 1 ? trackStyle : undefined}>
        {photos.map(p => (
          <img
            key={p.id}
            src={p.url}
            alt={spotName}
            loading="lazy"
            draggable={false}
            className="w-full h-full flex-shrink-0 object-contain"
          />
        ))}
      </div>

      {/* Full-bleed open target — under the dots/chips so those stay clickable */}
      <button
        type="button"
        onClick={() => onPhotoClick(index)}
        aria-label={`View ${spotName} photo full screen`}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sauce-400"
      />

      {seeAllHref && (
        <Link
          to={seeAllHref}
          onClick={e => e.stopPropagation()}
          className="absolute top-2 right-2 z-10 rounded-full bg-night-900/70 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-crowd text-cream-50 hover:bg-sauce-500 transition-colors"
        >
          See all →
        </Link>
      )}

      {photos.length > 1 && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center z-10">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setIndex(i) }}
              className="w-11 h-11 flex items-center justify-center"
              aria-label={`Photo ${i + 1}`}
            >
              <span className={`block rounded-full transition-all ${
                i === index
                  ? 'bg-cream-50 w-2.5 h-2.5 shadow-sm'
                  : 'bg-cream-50/55 w-1.5 h-1.5 hover:bg-cream-50/75'
              }`} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
