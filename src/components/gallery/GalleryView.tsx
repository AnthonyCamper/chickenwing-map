import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGallery } from '../../hooks/useGallery'
import { useAuthGate } from '../AuthGateModal'
import ReviewFeedCard from './ReviewFeedCard'
import CrawlFeedCard from './CrawlFeedCard'
import PeopleView from './PeopleView'
import FeedSkeleton from './FeedSkeleton'
import { useFollowsAnyone } from '../../hooks/useFollow'
import { supabase } from '../../lib/supabase'
import type { WingCrawlDetailed } from '../../lib/types'

type Feed = 'following' | 'discover' | 'crawls' | 'people'

interface Props {
  currentUserId: string
  isAdmin: boolean
  onViewOnMap?: (spotId: string) => void
  /** Opens the add-review form; omitted for signed-out visitors. */
  onAddReview?: () => void
}

const FEEDS: Feed[] = ['following', 'discover', 'crawls', 'people']
function isFeed(x: string | null): x is Feed { return !!x && (FEEDS as string[]).includes(x) }

export default function GalleryView({ currentUserId, isAdmin, onAddReview }: Props) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Default tab: Following for people who follow someone; Discover for
  // everyone else (signed out, brand-new accounts) — an empty Following tab
  // is a dead end right after sign-up. An explicit ?tab= always wins.
  const tabParam = searchParams.get('tab')
  const explicitFeed = isFeed(tabParam) ? tabParam : null
  const followsAnyone = useFollowsAnyone(explicitFeed ? '' : currentUserId)
  const defaultFeed: Feed | null = !currentUserId
    ? 'discover'
    : followsAnyone === null ? null : followsAnyone ? 'following' : 'discover'
  // null only while we're still finding out which tab is the default
  const feed: Feed | null = explicitFeed ?? defaultFeed

  const setFeed = (next: Feed) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      // Keep the URL explicit unless it's the default for this visitor
      if (!explicitFeed && next === defaultFeed) p.delete('tab')
      else p.set('tab', next)
      return p
    }, { replace: true })
  }

  const gallery = useGallery(currentUserId, feed === 'following', feed !== null)
  const { requireAuth } = useAuthGate()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Scroll restoration across route nav and full-page refresh ──────────────
  // Save the window scroll for the gallery feeds continuously; restore it once
  // after the list has painted. This covers both a back-nav remount (useGallery
  // seeds from its module cache) and a cold reload (useGallery re-fetches down
  // to the previously-loaded depth via sessionStorage, so the list is already
  // full-height here too) — either way the restore lands on the exact spot
  // instead of snapping to the top. Review feeds (following/discover) and the
  // crawls tab both participate; people is a short refetch-on-entry list.
  const isReviewFeed = feed === 'following' || feed === 'discover'
  const didRestoreScroll = useRef(false)

  useEffect(() => {
    if (!feed || feed === 'people') return
    const onScroll = () => {
      try { sessionStorage.setItem(`gallery-scroll:${feed}`, String(window.scrollY)) } catch { /* ignore */ }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [feed])

  useEffect(() => {
    if (didRestoreScroll.current || !isReviewFeed || gallery.loading) return
    if (gallery.error) return // failed load — keep the restore pending for a retry
    didRestoreScroll.current = true
    let saved = 0
    try { saved = Number(sessionStorage.getItem(`gallery-scroll:${feed}`) || 0) } catch { /* ignore */ }
    if (saved > 0) {
      // Double rAF: let the restored list lay out before scrolling.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)))
    }
  }, [feed, isReviewFeed, gallery.loading, gallery.error])

  // Crawls feed — fetched independently when the tab is active
  const CRAWLS_PAGE = 20
  const [crawls, setCrawls] = useState<WingCrawlDetailed[]>([])
  const [crawlsLoading, setCrawlsLoading] = useState(false)
  const [crawlsError, setCrawlsError] = useState<string | null>(null)
  const [crawlsReloadKey, setCrawlsReloadKey] = useState(0)
  const [crawlsPage, setCrawlsPage] = useState(1)
  const [crawlsHasMore, setCrawlsHasMore] = useState(false)

  useEffect(() => {
    if (feed !== 'crawls') return
    let cancelled = false
    // Only show the spinner on a fresh load — "load more" keeps the list up.
    if (crawlsPage === 1) setCrawlsLoading(true)
    setCrawlsError(null)
    const limit = crawlsPage * CRAWLS_PAGE
    supabase
      .from('wing_crawls_detailed')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit + 1) // one extra row = "there's more"
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setCrawlsError("Couldn't load the lists. Check your connection and try again.")
          setCrawls([])
          setCrawlsHasMore(false)
        } else {
          const rows = (data ?? []) as WingCrawlDetailed[]
          setCrawlsHasMore(rows.length > limit)
          setCrawls(rows.slice(0, limit))
        }
        setCrawlsLoading(false)
      })
    return () => { cancelled = true }
  }, [feed, crawlsReloadKey, crawlsPage])

  // Restore crawls-tab scroll once the list has painted.
  useEffect(() => {
    if (didRestoreScroll.current || feed !== 'crawls' || crawlsLoading || crawlsError) return
    if (crawls.length === 0) return
    didRestoreScroll.current = true
    let saved = 0
    try { saved = Number(sessionStorage.getItem('gallery-scroll:crawls') || 0) } catch { /* ignore */ }
    if (saved > 0) {
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)))
    }
  }, [feed, crawlsLoading, crawlsError, crawls.length])

  // Retry for the review feeds. useGallery is gaining a refresh() (owned by
  // another change); until it lands, loadMore refetches from the current
  // offset — after a failed first page that's offset 0, i.e. a retry.
  const retryFeed = () => {
    const g = gallery as typeof gallery & { refresh?: () => void }
    if (typeof g.refresh === 'function') g.refresh()
    else g.loadMore()
  }

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
        <div className="flex flex-wrap gap-1.5 mb-4" role="tablist" aria-label="Feed">
          {([['following', 'Following'], ['discover', 'Discover'], ['crawls', 'Lists'], ['people', 'People']] as [Feed, string][]).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={feed === f}
              onClick={() => setFeed(f)}
              className={`px-4 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-crowd border-2 transition-all ${
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
            // Fill the screen so the footer doesn't jump when lists arrive
            <div className="flex items-start justify-center pt-20 min-h-[100dvh]" role="status" aria-label="Loading lists">
              <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
            </div>
          ) : crawlsError ? (
            <div className="flex flex-col items-center justify-center pt-10 pb-28 sm:py-24 text-center px-6">
              <div className="text-5xl mb-4">🧯</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">Couldn't load lists</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">{crawlsError}</p>
              <button onClick={() => setCrawlsReloadKey(k => k + 1)} className="btn-secondary px-5">
                Try again
              </button>
            </div>
          ) : crawls.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-10 pb-28 sm:py-24 text-center px-6">
              <div className="text-5xl mb-4">📋</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No lists yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">
                No one has made a list yet. Make the first one.
              </p>
              <button
                onClick={() => { if (requireAuth()) navigate('/lists/new') }}
                className="btn-primary px-5"
              >
                + New list
              </button>
            </div>
          ) : (
            <>
              {/* Create affordance lives where lists live, not just in the empty state */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-charcoal-500">
                  {crawls.length}{crawlsHasMore ? '+' : ''} {crawls.length === 1 && !crawlsHasMore ? 'list' : 'lists'}
                </span>
                <button
                  onClick={() => { if (requireAuth()) navigate('/lists/new') }}
                  className="btn-secondary text-xs px-3 py-2"
                >
                  + New list
                </button>
              </div>
              <div className="space-y-3">
                {crawls.map(c => <CrawlFeedCard key={c.id} crawl={c} />)}
              </div>
              {crawlsHasMore && (
                <div className="flex justify-center pt-4">
                  <button onClick={() => setCrawlsPage(p => p + 1)} className="btn-secondary px-5">
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : feed === null || gallery.loading ? (
        // Fixed-size placeholder cards, not a spinner: the list and the footer
        // below don't jump when the real cards arrive (layout shift on 3G).
        <div className="max-w-2xl mx-auto px-4 pb-safe-fab">
          <FeedSkeleton />
        </div>
      ) : gallery.error && gallery.reviews.length === 0 ? (
        // Full-screen error only when there's nothing to show — if we already
        // have items, keep rendering them (paging failures surface via toast).
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="text-5xl mb-4">🧯</div>
          <h3 className="font-display text-lg text-charcoal-700 mb-2">Couldn't load the feed</h3>
          <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">{gallery.error}</p>
          <button onClick={retryFeed} className="btn-secondary px-5">
            Try again
          </button>
        </div>
      ) : gallery.reviews.length === 0 ? (
        // Compact top + tall bottom padding: on a 375×667 phone the last
        // button must end above the floating "Rate wings" button (y≈587).
        <div className="flex flex-col items-center justify-center pt-2 pb-28 sm:py-24 text-center px-6">
          {feed === 'following' ? (
            <>
              <div className="text-4xl mb-2" aria-hidden="true">🍗</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">Nothing from people you follow yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed mb-5">
                Reviews from people you follow show here. Your own reviews are on your profile page.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {onAddReview && (
                  <button onClick={onAddReview} className="btn-primary px-5">
                    + Rate wings
                  </button>
                )}
                <button
                  onClick={() => setFeed('discover')}
                  className={onAddReview ? 'btn-secondary px-5' : 'btn-primary px-5'}
                >
                  Go to Discover
                </button>
                <button
                  onClick={() => setFeed('people')}
                  className="btn-secondary px-5"
                >
                  Find people to follow
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-5xl mb-4">🥁</div>
              <h3 className="font-display text-lg text-charcoal-700 mb-2">No reviews yet</h3>
              <p className="text-sm text-charcoal-600 max-w-xs leading-relaxed">
                New reviews show here. Tap "Rate wings" to add the first one.
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
                currentUserId={currentUserId}
                isAdmin={isAdmin}
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
            <p className="text-center text-xs text-charcoal-400 py-6 uppercase tracking-crowd font-bold">
              You're all caught up 🍗
            </p>
          )}
        </div>
      )}
    </>
  )
}
