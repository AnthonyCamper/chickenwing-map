import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

interface ViewerProfile {
  username: string | null
  avatar_url: string | null
  display_name: string | null
}

export default function TopBar() {
  const [viewer, setViewer] = useState<ViewerProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProfile(userId: string | undefined) {
      if (!userId) {
        if (!cancelled) { setViewer(null); setLoaded(true) }
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, display_name')
        .eq('id', userId)
        .maybeSingle()
      if (!cancelled) {
        setViewer((data as ViewerProfile | null) ?? null)
        setLoaded(true)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      loadProfile(session?.user?.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user?.id)
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  return (
    <div className="border-b-2 border-night-900 bg-night-900">
      <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 group">
          <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-md border-2 border-cream-50/20 group-hover:border-sauce-400 transition-colors" />
          <span className="font-display uppercase tracking-crowd text-sm text-cream-50 group-hover:text-sauce-300 transition-colors">
            WingKingTony
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {!loaded ? (
            <div className="w-7 h-7 rounded-full bg-cream-50/10 animate-pulse" />
          ) : viewer?.username ? (
            <Link
              to={`/u/${viewer.username}`}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-crowd text-cream-50/80 hover:text-sauce-300 transition-colors"
            >
              {viewer.avatar_url ? (
                <img src={viewer.avatar_url} alt="" className="w-7 h-7 rounded-full border-2 border-cream-50/30 object-cover" />
              ) : (
                <span className="w-7 h-7 rounded-full border-2 border-cream-50/30 bg-night-700 flex items-center justify-center text-[11px] font-extrabold text-cream-50">
                  {(viewer.display_name ?? viewer.username ?? '?').charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          ) : (
            <Link
              to="/login"
              className="text-xs font-extrabold uppercase tracking-crowd text-cream-50/80 hover:text-sauce-300 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
