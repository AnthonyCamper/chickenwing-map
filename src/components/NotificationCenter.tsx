import { formatDistanceToNow } from 'date-fns'
import { supabase } from '../lib/supabase'
import type { UseNotificationsReturn } from '../hooks/useNotifications'
import type { Notification } from '../lib/types'

interface Props {
  notifications: UseNotificationsReturn
  onClose: () => void
}

export default function NotificationCenter({ notifications, onClose }: Props) {
  const {
    notifications: items,
    loading,
    unreadCount,
    markRead,
    markAllRead,
    loadMore,
    hasMore,
    enablePush,
    pushSubscribed,
    pushSupported,
  } = notifications

  const handleNotificationClick = async (notif: Notification) => {
    markRead(notif.id)
    onClose()

    // Crawl notifications — look up slug then dispatch deep-link
    if (notif.crawl_id) {
      const { data } = await supabase
        .from('wing_crawls')
        .select('slug')
        .eq('id', notif.crawl_id)
        .maybeSingle()
      if (data?.slug) {
        window.dispatchEvent(new CustomEvent('push-deep-link', {
          detail: { crawlSlug: data.slug },
        }))
        return
      }
    }

    let photoId = notif.photo_id
    const reviewId = notif.review_id
    const commentId = notif.comment_id

    // Resolve review_id from comment_id if missing
    if (!photoId && !reviewId && commentId) {
      const { data } = await supabase
        .from('review_comments')
        .select('review_id')
        .eq('id', commentId)
        .maybeSingle()
      if (data) {
        window.dispatchEvent(new CustomEvent('push-deep-link', {
          detail: { reviewId: data.review_id, commentId },
        }))
        return
      }
    }

    // Navigate to the relevant content via deep-link event (no full reload)
    if (photoId || reviewId) {
      window.dispatchEvent(new CustomEvent('push-deep-link', {
        detail: { photoId, reviewId, commentId },
      }))
    }
  }

  return (
    <div
      className="absolute right-0 top-full mt-2 w-[min(22rem,calc(100vw-1rem))] bg-cream-50 rounded-2xl shadow-elevated border-2 border-night-900 overflow-hidden z-50 animate-slide-up"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-night-900/10 flex items-center justify-between gap-2">
        <h3 className="font-display uppercase tracking-wide text-sm text-night-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-1.5 text-xs font-bold normal-case text-charcoal-500">
              ({unreadCount} new)
            </span>
          )}
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="text-[11px] font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600 transition-colors flex-shrink-0"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Push opt-in banner */}
      {pushSupported && !pushSubscribed && (
        <button
          onClick={async () => {
            const result = await enablePush()
            if (result.error) {
              alert(result.error)
            }
          }}
          className="w-full px-4 py-3 bg-sauce-50 border-b border-night-900/10 flex items-center gap-3 hover:bg-sauce-100 transition-colors text-left"
        >
          <span className="text-lg flex-shrink-0">🔔</span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-night-800">
              Enable push notifications
            </p>
            <p className="text-xs text-charcoal-500 mt-0.5">
              Get notified when someone interacts with your content
            </p>
          </div>
        </button>
      )}

      {/* Notification list — cap at 60dvh so it never exceeds the viewport on mobile */}
      <div className="max-h-[60dvh] overflow-y-auto">
        {loading && items.length === 0 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-cream-200 border-t-sauce-400 animate-spin" />
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">🍗</p>
            <p className="text-sm text-charcoal-500">No notifications yet</p>
            <p className="text-xs text-charcoal-400 mt-1">
              You'll see activity here when people interact with your content
            </p>
          </div>
        )}

        {items.map((notif) => (
          <button
            key={notif.id}
            onClick={() => handleNotificationClick(notif)}
            className={`w-full px-4 py-3 flex items-start gap-3 text-left transition-colors border-b border-night-900/10 last:border-0 min-h-[64px] ${
              notif.read
                ? 'hover:bg-cream-100'
                : 'bg-sauce-50/60 hover:bg-sauce-50'
            }`}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              <NotificationIcon type={notif.type} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm leading-snug ${
                notif.read ? 'text-charcoal-500' : 'text-night-800 font-medium'
              }`}>
                {notif.preview_text || getDefaultText(notif)}
              </p>
              {notif.shop_name && notif.type === 'new_review' && (
                <p className="text-xs text-charcoal-500 mt-0.5 truncate">
                  at {notif.shop_name}
                </p>
              )}
              <p className="text-xs text-charcoal-400 mt-1">
                {formatTime(notif.created_at)}
              </p>
            </div>

            {/* Unread dot */}
            {!notif.read && (
              <div className="flex-shrink-0 mt-2">
                <div className="w-2 h-2 rounded-full bg-sauce-400" />
              </div>
            )}
          </button>
        ))}

        {/* Load more */}
        {hasMore && items.length > 0 && (
          <button
            onClick={loadMore}
            className="w-full py-3 text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600 hover:bg-cream-100 transition-colors"
          >
            Load more
          </button>
        )}
      </div>
    </div>
  )
}

function NotificationIcon({ type }: { type: string }) {
  const iconClass = "w-8 h-8 rounded-full flex items-center justify-center text-sm"

  switch (type) {
    case 'new_review':
      return <div className={`${iconClass} bg-sauce-100`}>🍗</div>
    case 'photo_comment':
    case 'comment_reply':
      return <div className={`${iconClass} bg-neon-100`}>💬</div>
    case 'photo_like':
    case 'review_like':
      return <div className={`${iconClass} bg-sauce-100`}>❤️</div>
    case 'review_reaction':
      return <div className={`${iconClass} bg-gold-100`}>😄</div>
    case 'comment_like':
      return <div className={`${iconClass} bg-sauce-100`}>👍</div>
    case 'comment_reaction':
      return <div className={`${iconClass} bg-gold-100`}>😄</div>
    case 'crawl_like':
      return <div className={`${iconClass} bg-sauce-100`}>❤️</div>
    case 'new_crawl_from_followed_user':
      return <div className={`${iconClass} bg-sauce-100`}>📋</div>
    default:
      return <div className={`${iconClass} bg-cream-100`}>🔔</div>
  }
}

function getDefaultText(notif: Notification): string {
  switch (notif.type) {
    case 'new_review': return 'New review posted'
    case 'photo_comment': return 'Someone commented on your photo'
    case 'comment_reply': return 'Someone replied in a thread'
    case 'photo_like': return 'Someone liked your photo'
    case 'review_like': return notif.shop_name ? `Someone liked your ${notif.shop_name} review` : 'Someone liked your review'
    case 'review_reaction': return notif.shop_name ? `New reaction on your ${notif.shop_name} review` : 'New reaction on your review'
    case 'comment_like': return 'Someone liked your comment'
    case 'comment_reaction': return 'New reaction on your comment'
    case 'crawl_like': return 'Someone liked your list'
    case 'new_crawl_from_followed_user': return 'New list from someone you follow'
    default: return 'New notification'
  }
}

function formatTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return ''
  }
}
