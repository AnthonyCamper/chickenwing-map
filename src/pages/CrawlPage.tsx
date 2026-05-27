import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { deleteCrawl } from '../lib/crawlActions'
import TopBar from '../components/ui/TopBar'
import type { WingCrawlDetailed, WingCrawlItem, WingSpot } from '../lib/types'

interface ItemWithSpot extends WingCrawlItem {
  spot: WingSpot | null
  spot_top_photo: string | null
  spot_avg_rating: number | null
  spot_review_count: number
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
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

    const { data: rawItems } = await supabase
      .from('wing_crawl_items')
      .select('*')
      .eq('crawl_id', (crawl as WingCrawlDetailed).id)
      .order('position', { ascending: true })

    const itemList = (rawItems ?? []) as WingCrawlItem[]
    const spotIds = itemList.map(i => i.wing_spot_id)

    let spotsById: Record<string, WingSpot> = {}
    let ratingsBySpot: Record<string, { avg: number; count: number }> = {}
    let topPhotoBySpot: Record<string, string> = {}

    if (spotIds.length > 0) {
      const [{ data: spots }, { data: reviews }] = await Promise.all([
        supabase.from('wing_spots').select('*').in('id', spotIds),
        supabase
          .from('reviews_with_profiles')
          .select('id, wing_spot_id, overall_rating')
          .in('wing_spot_id', spotIds),
      ])

      for (const s of (spots ?? []) as WingSpot[]) spotsById[s.id] = s

      const groups: Record<string, number[]> = {}
      const reviewIdsBySpot: Record<string, string[]> = {}
      for (const r of (reviews ?? []) as { id: string; wing_spot_id: string; overall_rating: number }[]) {
        if (!groups[r.wing_spot_id]) groups[r.wing_spot_id] = []
        groups[r.wing_spot_id].push(Number(r.overall_rating))
        if (!reviewIdsBySpot[r.wing_spot_id]) reviewIdsBySpot[r.wing_spot_id] = []
        reviewIdsBySpot[r.wing_spot_id].push(r.id)
      }
      for (const [sid, ratings] of Object.entries(groups)) {
        const sum = ratings.reduce((a, b) => a + b, 0)
        ratingsBySpot[sid] = { avg: sum / ratings.length, count: ratings.length }
      }

      const allReviewIds = Object.values(reviewIdsBySpot).flat()
      if (allReviewIds.length > 0) {
        const { data: photos } = await supabase
          .from('review_photos')
          .select('review_id, url, display_order')
          .in('review_id', allReviewIds)
          .order('display_order', { ascending: true })
        const reviewToPhoto: Record<string, string> = {}
        for (const p of (photos ?? []) as { review_id: string; url: string }[]) {
          if (!reviewToPhoto[p.review_id]) reviewToPhoto[p.review_id] = p.url
        }
        for (const [sid, rids] of Object.entries(reviewIdsBySpot)) {
          for (const rid of rids) {
            if (reviewToPhoto[rid]) { topPhotoBySpot[sid] = reviewToPhoto[rid]; break }
          }
        }
      }
    }

    const items: ItemWithSpot[] = itemList.map(it => ({
      ...it,
      spot: spotsById[it.wing_spot_id] ?? null,
      spot_avg_rating: ratingsBySpot[it.wing_spot_id]?.avg ?? null,
      spot_review_count: ratingsBySpot[it.wing_spot_id]?.count ?? 0,
      spot_top_photo: topPhotoBySpot[it.wing_spot_id] ?? null,
    }))

    setData({ crawl: crawl as WingCrawlDetailed, items, isOwner })
    setStatus('ready')
  }, [slug])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!data) return
    setDeleting(true)
    const { error } = await deleteCrawl(data.crawl.id)
    if (error) {
      toast.error(error)
      setDeleting(false)
      setConfirmDelete(false)
    } else {
      toast.success('Crawl deleted')
      if (data.crawl.author_username) navigate(`/u/${data.crawl.author_username}`)
      else navigate('/')
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </div>
    )
  }

  if (status === 'not-found') {
    return (
      <div className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="eyebrow">404</p>
        <h1 className="font-display uppercase text-3xl text-night-900">No crawl here</h1>
        <Link to="/" className="btn-secondary">Back to the map</Link>
      </div>
    )
  }

  if (status === 'error' || !data) {
    return (
      <div className="min-h-dvh bg-paper flex flex-col items-center justify-center px-6 text-center gap-4">
        <h1 className="font-display uppercase text-3xl text-night-900">Something broke</h1>
        <Link to="/" className="btn-secondary">Back to the map</Link>
      </div>
    )
  }

  const { crawl, items, isOwner } = data
  const coverPhoto = crawl.cover_image_url ?? items.find(i => i.spot_top_photo)?.spot_top_photo ?? null
  const gridPhotos = !crawl.cover_image_url
    ? items.filter(i => i.spot_top_photo).slice(0, 4).map(i => i.spot_top_photo!)
    : []
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
        <link rel="canonical" href={`https://wingkingtony.com/lists/${crawl.slug}`} />
      </Helmet>

      <TopBar />

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
            {crawl.is_ranked ? 'Ranked crawl' : 'Crawl'}
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

            {isOwner && (
              <div className="ml-auto flex items-center gap-2">
                <Link to={`/crawls/${crawl.id}/edit`} className="btn-secondary px-3 py-1 text-xs">
                  Edit
                </Link>
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-sauce-600 transition-colors"
                  >
                    Delete
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-500">Sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-[11px] font-extrabold uppercase tracking-crowd text-sauce-600 hover:text-sauce-700 disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-charcoal-600"
                    >
                      Nope
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {items.length === 0 ? (
          <p className="text-charcoal-500 text-sm italic">
            No spots yet.{isOwner && (
              <> <Link to={`/crawls/${crawl.id}/edit`} className="text-sauce-500 hover:underline">Add some →</Link></>
            )}
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((it, idx) => (
              <li key={it.id}>
                <CrawlItemRow item={it} rank={crawl.is_ranked ? idx + 1 : null} />
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}

function CrawlItemRow({ item, rank }: { item: ItemWithSpot; rank: number | null }) {
  const { spot } = item
  if (!spot) {
    return (
      <div className="bg-cream-50 border-2 border-night-900 rounded-xl p-4 shadow-sticker">
        <p className="text-sm text-charcoal-500 italic">Spot removed.</p>
      </div>
    )
  }

  return (
    <Link
      to={spot.slug ? `/spots/${spot.slug}` : '#'}
      className="block bg-cream-50 border-2 border-night-900 rounded-xl p-4 shadow-sticker hover:shadow-stickerHover transition-shadow"
    >
      <div className="flex items-start gap-3">
        {rank != null && (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sauce-400 border-2 border-night-900 flex items-center justify-center font-display text-lg text-night-900 shadow-sticker-sm">
            {rank}
          </div>
        )}

        {item.spot_top_photo ? (
          <img
            src={item.spot_top_photo}
            alt=""
            loading="lazy"
            className="flex-shrink-0 w-16 h-16 rounded-lg object-cover border-2 border-night-900"
          />
        ) : null}

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
  )
}
