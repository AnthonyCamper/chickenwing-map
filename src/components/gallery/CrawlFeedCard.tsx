import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import HeartIcon from './HeartIcon'
import { useAuthGate } from '../AuthGateModal'
import { useAuthContext } from '../AuthProvider'
import { toggleCrawlLike } from '../../lib/crawlActions'
import type { WingCrawlDetailed } from '../../lib/types'

interface Props {
  crawl: WingCrawlDetailed
}

export default function CrawlFeedCard({ crawl }: Props) {
  const navigate = useNavigate()
  const { requireAuth } = useAuthGate()
  const auth = useAuthContext()
  const authorLinkable = !crawl.author_is_private && crawl.author_username
  const initial = (crawl.author_name ?? '?').charAt(0).toUpperCase()

  const [liked, setLiked] = useState(crawl.is_liked_by_me)
  const [likeCount, setLikeCount] = useState(crawl.like_count)
  const likeBusyRef = useRef(false)

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!requireAuth() || likeBusyRef.current || !auth?.user) return
    likeBusyRef.current = true
    const was = liked
    setLiked(!was)
    setLikeCount(c => c + (was ? -1 : 1))
    const { error } = await toggleCrawlLike(crawl.id, auth.user.id, was)
    if (error) {
      setLiked(was)
      setLikeCount(c => c + (was ? 1 : -1))
      toast.error('Could not update like')
    }
    likeBusyRef.current = false
  }

  return (
    <Link
      to={`/lists/${crawl.slug}`}
      className="block bg-cream-50 border-2 border-night-900/10 rounded-2xl overflow-hidden shadow-sm hover:border-night-900/30 transition-colors"
    >
      {/* Cover */}
      {crawl.cover_image_url ? (
        <div className="aspect-[16/9] bg-night-800 overflow-hidden">
          <img src={crawl.cover_image_url} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-gradient-to-br from-night-900 via-night-800 to-sauce-600 flex items-center justify-center px-6">
          <p className="font-display uppercase text-cream-50 text-2xl text-center leading-tight tracking-tightest line-clamp-3">
            {crawl.title}
          </p>
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <p className="eyebrow mb-1">
          {crawl.is_ranked ? 'Ranked list' : 'List'}
          {!crawl.is_public && ' · 🔒 Private'}
          {' · '}{crawl.item_count} {crawl.item_count === 1 ? 'spot' : 'spots'}
        </p>
        <h3 className="font-display uppercase text-lg text-night-900 leading-tight tracking-tightest line-clamp-2">
          {crawl.title}
        </h3>
        {crawl.description && (
          <p className="text-sm text-charcoal-600 mt-2 line-clamp-2">{crawl.description}</p>
        )}

        <div className="flex items-center gap-2 mt-3 text-xs">
          {crawl.author_avatar ? (
            <img src={crawl.author_avatar} alt="" className="w-5 h-5 rounded-full border border-night-900 object-cover" />
          ) : (
            <div className="w-5 h-5 rounded-full border border-night-900 bg-night-700 text-cream-50 flex items-center justify-center text-[10px] font-extrabold">
              {initial}
            </div>
          )}
          <span className="text-charcoal-500">by </span>
          {authorLinkable ? (
            <button
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/u/${crawl.author_username}`) }}
              className="min-h-[44px] -my-3 inline-flex items-center font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors"
            >
              {crawl.author_name}
            </button>
          ) : (
            <span className="font-extrabold uppercase tracking-crowd text-night-800">{crawl.author_name ?? 'Unknown'}</span>
          )}

          <button
            type="button"
            onClick={handleLike}
            aria-label={liked ? 'Unlike list' : 'Like list'}
            className={`ml-auto min-h-[44px] -my-3 px-2 inline-flex items-center gap-1 transition-colors ${
              liked ? 'text-sauce-500' : 'text-charcoal-400 hover:text-sauce-500'
            }`}
          >
            <HeartIcon filled={liked} className="w-4 h-4" />
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
        </div>
      </div>
    </Link>
  )
}
