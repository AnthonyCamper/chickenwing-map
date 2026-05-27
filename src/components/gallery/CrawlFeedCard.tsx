import { Link } from 'react-router-dom'
import HeartIcon from './HeartIcon'
import type { WingCrawlDetailed } from '../../lib/types'

interface Props {
  crawl: WingCrawlDetailed
}

export default function CrawlFeedCard({ crawl }: Props) {
  const authorLinkable = !crawl.author_is_private && crawl.author_username
  const initial = (crawl.author_name ?? '?').charAt(0).toUpperCase()

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
          {crawl.is_ranked ? 'Ranked crawl' : 'Crawl'}
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
            <span className="font-extrabold uppercase tracking-crowd text-night-800 hover:text-sauce-500 transition-colors">
              {crawl.author_name}
            </span>
          ) : (
            <span className="font-extrabold uppercase tracking-crowd text-night-800">{crawl.author_name ?? 'Unknown'}</span>
          )}

          {crawl.like_count > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 text-charcoal-400">
              <HeartIcon filled={crawl.is_liked_by_me} className="w-3.5 h-3.5" />
              <span>{crawl.like_count}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
