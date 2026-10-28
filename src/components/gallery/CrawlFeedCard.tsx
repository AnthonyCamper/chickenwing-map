import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import HeartIcon from './HeartIcon'
import AvatarImage from '../ui/AvatarImage'
import { useAuthGate } from '../AuthGateModal'
import { useAuthContext } from '../AuthProvider'
import { toggleCrawlLike } from '../../lib/crawlActions'
import { cleanUserText } from '../../lib/userText'
import type { WingCrawlDetailed } from '../../lib/types'

interface Props {
  crawl: WingCrawlDetailed
}

export default function CrawlFeedCard({ crawl }: Props) {
  const navigate = useNavigate()
  const { requireAuth } = useAuthGate()
  const auth = useAuthContext()
  const authorLinkable = !crawl.author_is_private && crawl.author_username
  const title = cleanUserText(crawl.title)
  const description = cleanUserText(crawl.description)
  // The view masks a private author's name ("Private wing-logger"); say it plainly.
  const authorName = crawl.author_is_private && crawl.user_id !== auth?.user?.id
    ? 'Private member'
    : cleanUserText(crawl.author_name) || 'Unknown'
  const initial = authorName.charAt(0).toUpperCase()

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
          <p className="user-text font-display uppercase text-cream-50 text-2xl text-center leading-tight tracking-tightest line-clamp-3 break-words min-w-0">
            {title}
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
        <h3 className="user-text font-display uppercase text-lg text-night-900 leading-tight tracking-tightest line-clamp-2 break-words">
          {title}
        </h3>
        {description && (
          <p className="user-text text-sm text-charcoal-600 mt-2 line-clamp-2 break-words">{description}</p>
        )}

        <div className="flex items-center gap-2 mt-3 text-xs">
          <AvatarImage
            src={crawl.author_avatar}
            alt=""
            className="w-5 h-5 flex-shrink-0 rounded-full border border-night-900 object-cover"
            fallback={
              <div className="w-5 h-5 flex-shrink-0 rounded-full border border-night-900 bg-night-700 text-cream-50 flex items-center justify-center text-[10px] font-extrabold">
                {initial}
              </div>
            }
          />
          <span className="text-charcoal-500 flex-shrink-0">by </span>
          {/* min-w-0 + truncate: long or multi-script names stay on one line
              with an ellipsis instead of wrapping into the "by" label. */}
          {authorLinkable ? (
            <button
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); navigate(`/u/${crawl.author_username}`) }}
              className="min-w-0 min-h-[44px] -my-3 inline-flex items-center font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors"
            >
              <span className="user-text truncate">{authorName}</span>
            </button>
          ) : (
            <span className="user-text min-w-0 truncate font-extrabold uppercase tracking-crowd text-night-800">{authorName}</span>
          )}

          <button
            type="button"
            onClick={handleLike}
            aria-label={liked ? 'Unlike list' : 'Like list'}
            className={`ml-auto flex-shrink-0 min-h-[44px] min-w-[44px] -my-3 px-2 inline-flex justify-center items-center gap-1 transition-colors ${
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
