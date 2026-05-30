import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGallery } from '../../hooks/useGallery'
import { useAuthGate } from '../AuthGateModal'
import ReviewFeedCard from './ReviewFeedCard'
import CrawlFeedCard from './CrawlFeedCard'
import PeopleView from './PeopleView'
import { supabase } from '../../lib/supabase'
import type { WingCrawlDetailed } from '../../lib/types'

type Feed = 'following' | 'discover' | 'crawls' | 'people'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (spotId: string) => void
}

const FEEDS: Feed[] = ['following', 'discover', 'crawls', 'people']
function isFeed(x: string | null): x is Feed { return !!x && (FEEDS as string[]).includes(x) }

export default function GalleryView({ currentUserId }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Default tab: signed-out / new users land on Discover, signed-in on Following.
  const defaultFeed: Feed = currentUserId ? 'following' : 'discover'
  const tabParam = searchParams.get('tab')
  const feed: Feed = isFeed(tabParam) ? tabParam : defaultFeed

  const setFeed = (next: Feed) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      if (next === defaultFeed) p.delete('tab')
      else p.set('tab', next)
      return p
    }, { replace: true })
  }

  const gallery = useGallery(currentUserId, feed === 'following' ? true : false)
  const { requireAuth } = useAuthGate()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Scroll restoration across route nav (drill into a card → swipe back) ──
  // Save the window scroll for the gallery feeds continuously; restore it once
  // after the (module-cached) list has painted. useGallery seeds its list from
  // a module cache on remount, so the page is already full-height here and the
  // restore lands on the exact spot instead of snapping to the top. Limited to
  // the infinite-scroll review feeds (following/discover); crawls/people are
  // short lists that refetch on entry, where a restore could overshoot.
  const isReviewFeed = feed === 'following' || feed === 'discover'
  const didRestoreScroll = useRef(false)

  useEffect(() => {
    if (!isReviewFeed) return
    const onScroll = () => {
      try { sessionStorage.setItem(`gallery-scroll:${feed}`, String(window.scrollY)) } catch { /* ignore */ }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [feed, isReviewFeed])

  useEffect(() => {
    if (didRestoreScroll.current || !isReviewFeed || gallery.loading) return
    didRestoreScroll.current = true
    // Only restore on a back-nav remount (list came from cache). On a cold
    // load the list is freshly fetched and short, so any saved offset would
    // overshoot — let those start at the top.
    if (!gallery.restoredFromCache) return
    let saved = 0
    try { saved = Number(sessionStorage.getItem(`gallery-scroll:${feed}`) || 0) } catch { /* ignore */ }
    if (saved > 0) {
      // Double rAF: let the restored list lay out before scrolling.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)))
    }
  }, [feed, isReviewFeed, gallery.loading, gallery.restoredFromCache])

  // Crawls feed — fetched independently when the tab is active
  const [crawls, setCrawls] = useState<WingCrawlDetailed[]>([])
  const [crawlsLoading, setCrawlsLoading] = useState(false)

  useEffect(() => {
    if (feed !== 'crawls') return
    let cancelled = false
    setCrawlsLoading(true)
    supabase
      .from('wing_crawls_detailed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (cancelled) return
        setCrawls((data ?? []) as WingCrawlDetailed[])
        setCrawlsLoading(false)
      })
    return () => { cancelled = true }
  }, [feed])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) gallery.loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [gallery.loadMore]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Feed tabs */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-1.5 mb-4" role="tablist" aria-label="Feed">
          {([['following', 'Following'], ['discover', 'Discover'], ['crawls', 'Lists'], ['people', 'People']] as [Feed, string][]).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={feed === f}
              onClick={() => setFeed(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-crowd border-2 transition-all ${
                feed === f
                  ? 'bg-night-900 border-night-900 text-cream-50'
                  : 'border-night-900/20 text-charcoal-600 hover:border-night-900/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {feed === 'people' ? (
        <PeopleView currentUserId={currentUserId} />
      ) : feed === 'crawls' ? (
        <div className="max-w-2xl mx-auto px-4 pb-safe-fab">
          {crawlsLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
            </div>
          ) : crawls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No lists yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">
                Be the first to curate a list. Stake your claim.
              </p>
              <button
                onClick={() => { if (requireAuth()) navigate('/lists/new') }}
                className="btn-primary px-5"
              >
                + New list
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {crawls.map(c => <CrawlFeedCard key={c.id} crawl={c} />)}
            </div>
          )}
        </div>
      ) : gallery.loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
        </div>
      ) : gallery.error ? (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <p className="text-charcoal-600 text-sm">{gallery.error}</p>
        </div>
      ) : gallery.reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center px-6">
          {feed === 'following' ? (
            <>
              <div className="text-5xl mb-4">🍗</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No takes yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">
                Follow some wing heads to see their takes here. Or check out Discover to see what everyone's eating.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFeed('people')}
                  className="btn-primary px-5"
                >
                  Find people
                </button>
                <button
                  onClick={() => setFeed('discover')}
                  className="btn-secondary px-5"
                >
                  Discover
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">🥁</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">Nothing here yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
                Be the first to drop a take. The wing council is waiting.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 pb-safe-fab">
          <div className="space-y-3">
            {gallery.reviews.map(review => (
              <ReviewFeedCard
                key={review.review_id}
                review={review}
                onOpen={() => navigate(`/reviews/${review.review_id}`)}
                onLike={() => { if (requireAuth()) gallery.toggleLike(review.review_id) }}
              />
            ))}
          </div>

          {gallery.hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-6">
              {gallery.loadingMore && (
                <div className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
              )}
            </div>
          )}

          {!gallery.hasMore && gallery.reviews.length > 0 && (
            <p className="text-center text-xs text-charcoal-300 py-6 uppercase tracking-crowd font-bold">
              You're all caught up 🍗
            </p>
          )}
        </div>
      )}
    </>
  )
}
