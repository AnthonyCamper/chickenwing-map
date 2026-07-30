import { useNavigate } from 'react-router-dom'
import type { EventRsvp, RsvpStatus } from '../../lib/types'

interface Props {
  signedIn: boolean
  myRsvp: EventRsvp | null
  submitting: RsvpStatus | null
  onRsvp: (status: RsvpStatus) => void
  onDropOut: () => void
}

/**
 * All RSVP states: anon sign-in CTA, fresh join, going, maybe/can't.
 * Hidden entirely in the wrapped phase (orchestrator's call).
 */
export default function EventRsvpPanel({ signedIn, myRsvp, submitting, onRsvp, onDropOut }: Props) {
  const navigate = useNavigate()

  if (!signedIn) {
    return (
      <section>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary w-full text-base py-4 shadow-elevated"
        >
          ✋ Sign in to join the crawl
        </button>
        <p className="text-xs text-charcoal-500 text-center mt-2">
          Takes a minute. The wings are worth it.
        </p>
      </section>
    )
  }

  if (myRsvp?.status === 'going') {
    return (
      <section className="card px-5 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✋</span>
            <div>
              <p className="font-extrabold text-night-900 text-sm uppercase tracking-crowd">You're in!</p>
              <p className="text-xs text-charcoal-500">See you at the crawl</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (!confirm('Drop your RSVP?')) return
              onDropOut()
            }}
            className="text-xs font-bold text-charcoal-500 hover:text-sauce-500 transition-colors"
          >
            Drop out
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(['maybe', 'not_going'] as RsvpStatus[]).map(s => (
            <button
              key={s}
              onClick={() => onRsvp(s)}
              disabled={submitting !== null}
              className="px-3 py-2 rounded-xl text-xs font-bold border-2 bg-cream-50 text-charcoal-600 border-night-900/20 hover:border-sauce-400 disabled:opacity-60 transition-all"
            >
              {submitting === s ? '…' : s === 'maybe' ? 'Change to Maybe' : "Can't make it"}
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (myRsvp) {
    return (
      <section className="card px-5 py-4">
        <p className="text-sm text-charcoal-600 mb-3">
          You said: <strong className="text-night-900">
            {myRsvp.status === 'maybe' ? 'Maybe' : "Can't make it"}
          </strong>
        </p>
        <button
          onClick={() => onRsvp('going')}
          disabled={submitting !== null}
          className="btn-primary w-full text-base py-3.5"
        >
          {submitting === 'going' ? 'Joining…' : '✋ Join the Crawl'}
        </button>
      </section>
    )
  }

  return (
    <section>
      <button
        onClick={() => onRsvp('going')}
        disabled={submitting !== null}
        className="btn-primary w-full text-base py-4 shadow-elevated"
      >
        {submitting === 'going' ? 'Joining…' : '✋ Join the Crawl'}
      </button>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={() => onRsvp('maybe')}
          disabled={submitting !== null}
          className="px-3 py-2 rounded-xl text-xs font-bold border-2 bg-cream-50 text-charcoal-600 border-night-900/20 hover:border-sauce-400 disabled:opacity-60 transition-all"
        >
          🤔 Maybe
        </button>
        <button
          onClick={() => onRsvp('not_going')}
          disabled={submitting !== null}
          className="px-3 py-2 rounded-xl text-xs font-bold border-2 bg-cream-50 text-charcoal-600 border-night-900/20 hover:border-sauce-400 disabled:opacity-60 transition-all"
        >
          🙅 Can't make it
        </button>
      </div>
    </section>
  )
}
