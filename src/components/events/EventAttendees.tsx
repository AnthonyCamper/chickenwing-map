import BadgeIcon from '../badges/BadgeIcon'
import type { EventRsvp } from '../../lib/types'

export interface CheckinAttendee {
  user_id: string
  display_name: string
  avatar_url: string | null
  stop_count: number
  badges: Array<{ id: string; name: string; icon: string; color: string }>
}

interface WhosComingProps {
  rsvps: EventRsvp[]
  /** Anon preview shows a count, not names. */
  signedIn: boolean
  goingCount: number
}

export function WhosComing({ rsvps, signedIn, goingCount }: WhosComingProps) {
  const going = rsvps.filter(r => r.status === 'going')

  if (!signedIn) {
    if (goingCount === 0) return null
    return (
      <section className="card px-5 py-4">
        <h3 className="font-display uppercase text-base text-night-900 tracking-tightest mb-1">
          Who's coming ({goingCount})
        </h3>
        <p className="text-sm text-charcoal-500">
          {goingCount === 1 ? 'One wing lover is in.' : `${goingCount} wing lovers are in.`} Sign in to see who.
        </p>
      </section>
    )
  }

  if (going.length === 0) return null

  return (
    <section className="card px-5 py-4">
      <h3 className="font-display uppercase text-base text-night-900 tracking-tightest mb-3">
        Who's coming ({going.length})
      </h3>
      <ul className="flex flex-wrap gap-2">
        {going.map(r => (
          <li
            key={r.id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cream-100 border-2 border-night-900/20 max-w-full min-w-0"
          >
            {r.is_private ? (
              <span className="w-5 h-5 rounded-full bg-cream-200 flex items-center justify-center text-xs">🔒</span>
            ) : r.user_avatar ? (
              <img src={r.user_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <span className="w-5 h-5 rounded-full bg-night-700 flex items-center justify-center text-xs font-bold text-cream-50">
                {(r.user_name ?? r.user_email ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-bold text-charcoal-600 truncate">
              {r.is_private ? 'Private' : (r.user_name ?? r.user_email)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface CheckedInFeedProps {
  attendees: CheckinAttendee[]
  totalStops: number
  isAdmin: boolean
  resetConfirmUserId: string | null
  resetingUserId: string | null
  onToggleResetConfirm: (userId: string | null) => void
  onResetProgress: (userId: string) => void
}

export function CheckedInFeed({
  attendees, totalStops, isAdmin,
  resetConfirmUserId, resetingUserId, onToggleResetConfirm, onResetProgress,
}: CheckedInFeedProps) {
  if (attendees.length === 0) return null

  return (
    <section className="card px-5 py-4">
      <h3 className="font-display uppercase text-base text-night-900 tracking-tightest mb-3">
        Checked in ({attendees.length})
      </h3>
      <ul className="space-y-3">
        {attendees.map(a => (
          <li key={a.user_id} className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              {a.avatar_url ? (
                <img src={a.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-night-900 flex-shrink-0" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-night-700 border-2 border-night-900 flex items-center justify-center text-sm font-extrabold text-cream-50 flex-shrink-0">
                  {a.display_name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-night-900 truncate">{a.display_name}</p>
                <p className="text-xs text-charcoal-500">
                  {a.stop_count}/{totalStops} {a.stop_count === 1 ? 'stop' : 'stops'}
                </p>
              </div>
              {a.badges.length > 0 && (
                <div className="flex items-center flex-shrink-0">
                  {a.badges.slice(0, 6).map((b, i) => (
                    <span
                      key={b.id}
                      title={b.name}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 border-white shadow-sm"
                      style={{
                        backgroundColor: b.color,
                        marginLeft: i > 0 ? '-8px' : 0,
                        zIndex: a.badges.length - i,
                        position: 'relative',
                      }}
                    >
                      <BadgeIcon icon={b.icon} className="w-4 h-4 text-cream-50" />
                    </span>
                  ))}
                  {a.badges.length > 6 && (
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-cream-200 text-charcoal-500 border-2 border-white shadow-sm"
                      style={{ marginLeft: '-8px', position: 'relative', zIndex: 0 }}
                    >
                      +{a.badges.length - 6}
                    </span>
                  )}
                </div>
              )}
              {isAdmin && (
                <button
                  onClick={() => onToggleResetConfirm(resetConfirmUserId === a.user_id ? null : a.user_id)}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-charcoal-400 hover:text-sauce-500 hover:bg-sauce-50 transition-colors"
                  title="Reset progress"
                  disabled={resetingUserId === a.user_id}
                >
                  {resetingUserId === a.user_id ? (
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-sauce-400 border-t-transparent animate-spin" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            {isAdmin && resetConfirmUserId === a.user_id && (
              <div className="ml-12 flex items-center gap-2 py-2 px-3 bg-sauce-50 border-2 border-sauce-300 rounded-xl">
                <p className="text-xs font-semibold text-sauce-700 flex-1">
                  Reset {a.display_name}'s check-ins, reviews & badges?
                </p>
                <button
                  onClick={() => onToggleResetConfirm(null)}
                  className="text-xs font-bold text-charcoal-500 hover:text-charcoal-700 px-2 py-1 rounded-lg hover:bg-cream-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => onResetProgress(a.user_id)}
                  disabled={!!resetingUserId}
                  className="text-xs font-extrabold text-cream-50 bg-sauce-500 hover:bg-sauce-600 px-3 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
