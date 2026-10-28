import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Follows `push-deep-link` events (a tapped push notification, relayed by
 * the service worker through useNotifications) from any page. Mounted once in
 * App so a push tapped while the user is on a spot or review page still opens
 * the right review/comment, not only when the feed happens to be on screen.
 */
export function usePushDeepLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = (e: Event) => {
      const { photoId, reviewId, commentId, crawlSlug } = (e as CustomEvent).detail
      // Same deep link as the in-app notification list: open the exact comment
      const hash = commentId ? `#comment-${commentId}` : ''
      if (crawlSlug) {
        navigate(`/lists/${crawlSlug}`)
      } else if (reviewId) {
        navigate(`/reviews/${reviewId}${hash}`)
      } else if (photoId) {
        ;(async () => {
          const { data } = await supabase
            .from('review_photos')
            .select('review_id')
            .eq('id', photoId)
            .maybeSingle()
          if (data?.review_id) navigate(`/reviews/${data.review_id}${hash}`)
        })()
      }
    }
    window.addEventListener('push-deep-link', handler)
    return () => window.removeEventListener('push-deep-link', handler)
  }, [navigate])
}
