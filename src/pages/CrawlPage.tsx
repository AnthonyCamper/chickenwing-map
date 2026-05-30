import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { deleteCrawl, toggleCrawlLike } from '../lib/crawlActions'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
import PhotoLightbox from '../components/ui/PhotoLightbox'
import CrawlRouteMap from '../components/ui/CrawlRouteMap'
import CrawlOwnerToolbar from '../components/ui/CrawlOwnerToolbar'
import HeartIcon from '../components/gallery/HeartIcon'
import CrawlCommentThread from '../components/CrawlCommentThread'
import { useAuthGate } from '../components/AuthGateModal'
import type { WingCrawlDetailed, WingCrawlItem, WingSpot } from '../lib/types'

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
  const { requireAuth } = useAuthGate()

  const load = useCallback(async () => {
    if (!slug) return
    setStatus('loading')

    const { data: crawl, error: crawlErr } = await supabase
      .from('wing_crawls_detailed')
      .select('*')
      .eq('slug', slug)
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

    if (spotIds.length > 0) {
      const [{ data: spots }, { data: reviews }] = await Promise.all([
        supabase.from('wing_spots').select('*').in('id', spotIds),
        supabase
          .from('reviews_with_profiles')
          .select('id, wing_spot_id, overall_rating, wing_flavor, review_text, visited_at, reviewer_name, reviewer_avatar')
          .in('wing_spot_id', spotIds)
          .order('visited_at', { ascending: false }),
      ])

      for (const s of (spots ?? []) as WingSpot[]) spotsById[s.id] = s

      const groups: Record<string, number[]> = {}
      const reviewToSpot: Record<string, string> = {}
      type RawReview = { id: string; wing_spot_id: string; overall_rating: number; wing_flavor: string | null; review_text: string | null; visited_at: string; reviewer_name: string | null; reviewer_avatar: string | null }
      for (const r of (reviews ?? []) as RawReview[]) {
        if (!groups[r.wing_spot_id]) groups[r.wing_spot_id] = []
        groups[r.wing_spot_id].push(r.overall_rating)
        reviewToSpot[r.id] = r.wing_spot_id
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
    }))

    setData({ crawl: crawl as WingCrawlDetailed, items, isOwner })
    setStatus('ready')
  }, [slug])

  useEffect(() => { load() }, [load])

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
    return (
      <PageStateShell>
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </PageStateShell>
    )
  }

  if (status === 'not-found') {
    return (
      <PageStateShell>
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">No list here</h1>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  if (status === 'error' || !data) {
    return (
      <PageStateShell>
        <h1 className="font-display uppercase text-3xl text-night-900">Something broke</h1>
        <Link to="/" className="btn-secondary">Back home</Link>
      </PageStateShell>
    )
  }

  const { crawl, items, isOwner } = data
  const allItemPhotos = items.flatMap(i => i.spot_photos.map(p => p.url))
  const coverPhoto = crawl.cover_image_url ?? allItemPhotos[0] ?? null
  const gridPhotos = !crawl.cover_image_url ? allItemPhotos.slice(0, 4) : []
  const authorPrivate = crawl.author_is_private
  const authorLinkable = !authorPrivate && crawl.author_username
  const description = crawl.description?.trim()
    ? crawl.description.trim().slice(0, 200)
    : `${crawl.item_count} wing ${crawl.item_count === 1 ? 'spot' : 'spots'} curated by ${crawl.author_name ?? 'a wing-logger'} on WingKingTony.`

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{crawl.title} — WingKingTony</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${crawl.title} — WingKingTony`} />
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
          <div className="w-full h-48 sm:h-64 bg-night-900 overflow-hidden">
            <img src={crawl.cover_image_url} alt="" className="w-full h-full object-cover" />
          </div>
        ) : gridPhotos.length > 0 ? (
          <div className="w-full h-48 sm:h-64 grid grid-cols-2 sm:grid-cols-4 gap-px bg-night-900">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden bg-night-800">
                {gridPhotos[i] ? (
                  <img src={gridPhotos[i]} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="max-w-3xl mx-auto px-5 py-6">
          <p className="eyebrow mb-2">
            {crawl.is_ranked ? 'Ranked list' : 'List'}
            {!crawl.is_public && ' · Private'}
          </p>
          <h1 className="font-display uppercase text-4xl md:text-5xl text-night-900 leading-none tracking-tightest">
            {crawl.title}
          </h1>
          {crawl.description && (
            <p className="text-sm text-charcoal-700 mt-3 max-w-prose whitespace-pre-wrap">{crawl.description}</p>
          )}

          <div className="flex items-center gap-3 mt-5">
            {crawl.author_avatar ? (
              <img src={crawl.author_avatar} alt="" className="w-8 h-8 rounded-full border-2 border-night-900 object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-night-900 bg-cream-200 flex items-center justify-center text-xs font-bold text-night-900">
                {(crawl.author_name ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="text-xs">
              <span className="text-charcoal-500">by </span>
              {authorLinkable ? (
                <Link to={`/u/${crawl.author_username}`} className="font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors">
                  {crawl.author_name}
                </Link>
              ) : (
                <span className="font-extrabold uppercase tracking-crowd text-night-800">{crawl.author_name ?? 'Unknown'}</span>
              )}
              <span className="text-charcoal-400"> · {crawl.item_count} {crawl.item_count === 1 ? 'spot' : 'spots'}</span>
            </div>

            <button
              onClick={handleToggleLike}
              disabled={likeBusy}
              aria-label={crawl.is_liked_by_me ? 'Unlike list' : 'Like list'}
              className="ml-auto inline-flex items-center gap-1.5 min-h-[44px] -my-2 px-2 text-charcoal-500 hover:text-sauce-500 transition-colors disabled:opacity-50"
            >
              <HeartIcon filled={crawl.is_liked_by_me} className="w-5 h-5" />
              {crawl.like_count > 0 && (
                <span className="text-xs font-bold">{crawl.like_count}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-safe-fab">
        {items.length > 0 && (
          <div className="mb-6">
            <CrawlRouteMap
              items={items}
              ranked={crawl.is_ranked}
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
          <ol className="space-y-3">
            {items.map((it, idx) => (
              <li key={it.id}>
                <CrawlItemRow
                  item={it}
                  rank={crawl.is_ranked ? idx + 1 : null}
                  onPhotoClick={(photoIdx) => setLightbox({ photos: it.spot_photos, index: photoIdx })}
                />
              </li>
            ))}
          </ol>
        )}

        {/* Comments */}
        <section className="mt-10 pt-6 border-t-2 border-night-900/10">
          <h2 className="eyebrow mb-3">Comments</h2>
          <CrawlCommentThread
            crawlId={crawl.id}
            currentUserId={currentUserId}
            isAdmin={false}
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
  item, rank, onPhotoClick,
}: {
  item: ItemWithSpot
  rank: number | null
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

  return (
    <div className="bg-cream-50 border-2 border-night-900 rounded-xl shadow-sticker overflow-hidden">
      {/* Header — links to spot */}
      <Link
        to={spot.slug ? `/spots/${spot.slug}` : '#'}
        className="block p-4 hover:bg-cream-100/50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {rank != null && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sauce-400 border-2 border-night-900 flex items-center justify-center font-display text-lg text-night-900 shadow-sticker-sm">
              {rank}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-display uppercase text-lg text-night-900 truncate tracking-tightest">{spot.name}</p>
                <p className="text-xs text-charcoal-500 truncate">{spot.address}</p>
              </div>
              {item.spot_avg_rating != null && (
                <div className="flex items-center gap-1 px-2 py-1 bg-cream-100 border-2 border-night-900 rounded shrink-0">
                  <span className="font-display text-sm text-night-900">{item.spot_avg_rating.toFixed(1)}</span>
                  <span className="text-[10px] uppercase font-bold tracking-crowd text-charcoal-500">/10</span>
                </div>
              )}
            </div>
            {item.note && (
              <p className="text-sm text-charcoal-700 mt-2 italic whitespace-pre-wrap">"{item.note}"</p>
            )}
          </div>
        </div>
      </Link>

      {/* Photo strip */}
      {photos.length > 0 && (
        <div className="border-t-2 border-night-900/10 px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPhotoClick(i)}
              className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-night-900 hover:border-sauce-400 transition-colors"
            >
              <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
          {spot.slug && (
            <Link
              to={`/spots/${spot.slug}`}
              className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-night-900/30 hover:border-sauce-400 flex flex-col items-center justify-center text-charcoal-400 hover:text-sauce-500 transition-colors text-[10px] font-extrabold uppercase tracking-crowd text-center px-1"
            >
              See all →
            </Link>
          )}
        </div>
      )}

      {/* Recent reviews */}
      {reviews.length > 0 && (
        <div className="border-t-2 border-night-900/10 divide-y divide-night-900/8">
          {reviews.map(r => {
            const dateStr = (() => { try { return format(new Date(r.visited_at), 'MMM d, yyyy') } catch { return r.visited_at } })()
            const name = r.reviewer_name ?? 'Anonymous'
            const initials = name.charAt(0).toUpperCase()
            return (
              <Link key={r.id} to={`/reviews/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-cream-100/50 transition-colors">
                <div className="flex-shrink-0 w-7 h-7 rounded-full border-2 border-night-900 bg-night-700 flex items-center justify-center overflow-hidden">
                  {r.reviewer_avatar
                    ? <img src={r.reviewer_avatar} alt={name} className="w-full h-full object-cover" />
                    : <span className="text-[10px] font-extrabold text-cream-50 uppercase">{initials}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold uppercase tracking-crowd text-night-800">{name}</span>
                    <span className="font-display text-sm text-sauce-500">{Number(r.overall_rating).toFixed(1)}<span className="text-[10px] text-charcoal-400">/10</span></span>
                    {r.wing_flavor && <span className="text-[11px] text-charcoal-500">{r.wing_flavor}</span>}
                    <span className="text-[10px] text-charcoal-400 ml-auto">{dateStr}</span>
                  </div>
                  {r.review_text && (
                    <p className="text-xs text-charcoal-600 mt-0.5 line-clamp-2 leading-relaxed">{r.review_text}</p>
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
