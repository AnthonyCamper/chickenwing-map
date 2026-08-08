import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import type { AuthState } from '../hooks/useAuth'
import { useEvent } from '../hooks/useEvent'
import { useReviews } from '../hooks/useReviews'
import { useBadges } from '../hooks/useBadges'
import ReviewFormModal from '../components/ReviewFormModal'
import ReviewEditModal from '../components/ReviewEditModal'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
import ShareButton from '../components/ui/ShareButton'
import EventHero from '../components/events/EventHero'
import EventRsvpPanel from '../components/events/EventRsvpPanel'
import EventProgress from '../components/events/EventProgress'
import EventRoute from '../components/events/EventRoute'
import EventBadges from '../components/events/EventBadges'
import EventRecap from '../components/events/EventRecap'
import { WhosComing, CheckedInFeed, type CheckinAttendee } from '../components/events/EventAttendees'
import { eventPhase } from '../lib/eventPhase'
import { supabase } from '../lib/supabase'
import type { BadgeWithEarned, EventStop, Review, ReviewPhoto, ReviewFormData, RsvpStatus } from '../lib/types'

interface Props {
  auth: AuthState
}

export default function EventPage({ auth }: Props) {
  const { slug } = useParams<{ slug?: string }>()
  const navigate = useNavigate()
  const userId = auth.user?.id ?? null
  const signedIn = !!userId
  const evt = useEvent(slug ?? null, userId)
  const reviews = useReviews()
  const badges = useBadges(userId)

  const [reviewingStop, setReviewingStop] = useState<EventStop | null>(null)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [loadingReviewId, setLoadingReviewId] = useState<string | null>(null)
  const [rsvpSubmitting, setRsvpSubmitting] = useState<RsvpStatus | null>(null)
  const [checkinSubmitting, setCheckinSubmitting] = useState<string | null>(null)
  const [checkinAttendees, setCheckinAttendees] = useState<CheckinAttendee[]>([])
  const [resetConfirmUserId, setResetConfirmUserId] = useState<string | null>(null)
  const [resetingUserId, setResetingUserId] = useState<string | null>(null)
  const [anonGoingCount, setAnonGoingCount] = useState<number | null>(null)
  const [anonBadges, setAnonBadges] = useState<BadgeWithEarned[]>([])

  const checkedInStopIds = useMemo(
    () => new Set(evt.myCheckins.map(c => c.event_stop_id)),
    [evt.myCheckins]
  )

  // Badges scoped to this event, from the signed-in user's earned view
  const myEventBadges = useMemo(
    () => badges.badges.filter(b => b.event_id === evt.event?.id),
    [badges.badges, evt.event?.id]
  )
  const eventBadges = signedIn ? myEventBadges : anonBadges

  // Anon preview: RLS hides rsvp rows and badges_for_user, so fetch the
  // aggregate count + the public badge list directly.
  useEffect(() => {
    const eventId = evt.event?.id
    if (signedIn || !eventId) return
    let cancelled = false
    supabase.rpc('event_going_count', { p_event_id: eventId }).then(({ data }) => {
      if (!cancelled && typeof data === 'number') setAnonGoingCount(data)
    })
    supabase
      .from('badges')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return
        setAnonBadges(((data ?? []) as BadgeWithEarned[]).map(b => ({ ...b, earned: false, earned_at: null })))
      })
    return () => { cancelled = true }
  }, [signedIn, evt.event?.id])

  // Fetch all checked-in attendees with their badges (signed-in only)
  useEffect(() => {
    const eventId = evt.event?.id
    if (!eventId || !signedIn) { setCheckinAttendees([]); return }
    let cancelled = false
    const load = async () => {
      const { data: checkins } = await supabase
        .from('event_checkins')
        .select('user_id, event_stop_id')
        .eq('event_id', eventId)
      if (cancelled || !checkins?.length) { setCheckinAttendees([]); return }

      const stopCountMap = new Map<string, number>()
      for (const c of checkins) {
        stopCountMap.set(c.user_id, (stopCountMap.get(c.user_id) ?? 0) + 1)
      }
      const userIds = [...stopCountMap.keys()]

      const [profilesRes, badgesRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, full_name, avatar_url, email, is_private').in('id', userIds),
        supabase.from('user_badges').select('user_id, badges!inner(id, name, icon, color)').in('user_id', userIds),
      ])
      if (cancelled) return

      type UBRow = { user_id: string; badges: { id: string; name: string; icon: string; color: string } }
      const badgesMap = new Map<string, Array<{ id: string; name: string; icon: string; color: string }>>()
      for (const ub of (badgesRes.data ?? []) as unknown as UBRow[]) {
        const arr = badgesMap.get(ub.user_id) ?? []
        arr.push(ub.badges)
        badgesMap.set(ub.user_id, arr)
      }

      const attendees: CheckinAttendee[] = (profilesRes.data ?? [])
        .filter((p: { id: string; is_private?: boolean }) => !p.is_private || p.id === userId || auth.isAdmin)
        .map((p: { id: string; display_name: string | null; full_name: string | null; avatar_url: string | null; email: string | null }) => ({
          user_id: p.id,
          display_name: p.display_name ?? p.full_name ?? p.email ?? 'Unknown',
          avatar_url: p.avatar_url ?? null,
          stop_count: stopCountMap.get(p.id) ?? 0,
          badges: badgesMap.get(p.id) ?? [],
        }))
      attendees.sort((a, b) => b.stop_count - a.stop_count)
      setCheckinAttendees(attendees)
    }
    load()
    return () => { cancelled = true }
  }, [evt.event?.id, evt.myCheckins, signedIn])

  const handleResetProgress = async (targetUserId: string) => {
    const eventId = evt.event?.id
    if (!eventId) return
    setResetingUserId(targetUserId)
    try {
      const results = await Promise.all([
        supabase.from('event_checkins').delete().match({ event_id: eventId, user_id: targetUserId }),
        supabase.from('reviews').delete().match({ event_id: eventId, user_id: targetUserId }),
        supabase.from('user_badges').delete().match({ event_id: eventId, user_id: targetUserId }),
      ])
      // Supabase returns errors instead of throwing — don't toast success
      // when the deletes were silently rejected (RLS, network).
      const firstError = results.map(r => r.error).find(Boolean)
      if (firstError) {
        toast.error(`Reset failed: ${firstError.message}`)
        return
      }
      const name = checkinAttendees.find(a => a.user_id === targetUserId)?.display_name ?? 'User'
      toast.success(`Reset ${name}'s progress`)
      setCheckinAttendees(prev => prev.filter(a => a.user_id !== targetUserId))
      if (targetUserId === userId) await evt.refresh()
    } catch {
      toast.error('Reset failed — try again')
    } finally {
      setResetingUserId(null)
      setResetConfirmUserId(null)
    }
  }

  if (evt.loading) {
    return (
      <PageStateShell>
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </PageStateShell>
    )
  }

  if (!evt.event) {
    return (
      <PageStateShell>
        <p className="text-5xl">🍗</p>
        <p className="eyebrow">Quiet night</p>
        <h2 className="font-display uppercase text-3xl text-night-900">No active crawl</h2>
        <p className="text-sm text-charcoal-600">There's no published crawl right now. Check back soon.</p>
        <button onClick={() => navigate('/')} className="btn-secondary">Back home</button>
      </PageStateShell>
    )
  }

  const e = evt.event
  const phase = eventPhase(e, evt.stops.length)
  const startsAt = e.starts_at ? new Date(e.starts_at) : null
  const endsAt   = e.ends_at   ? new Date(e.ends_at)   : null
  const dateRange = (() => {
    if (!startsAt) return null
    if (endsAt && endsAt.toDateString() !== startsAt.toDateString()) {
      return `${format(startsAt, 'MMM d')} – ${format(endsAt, 'MMM d, yyyy')}`
    }
    return format(startsAt, 'EEEE, MMM d, yyyy')
  })()
  const unlockLabel = startsAt ? format(startsAt, 'MMM d') : null
  const goingCount = signedIn
    ? (e.going_count ?? evt.rsvps.filter(r => r.status === 'going').length)
    : (anonGoingCount ?? e.going_count ?? 0)
  const totalCheckins = checkinAttendees.reduce((sum, a) => sum + a.stop_count, 0)

  const handleRsvp = async (status: RsvpStatus) => {
    if (!userId) { toast.error('Sign in to RSVP'); return }
    setRsvpSubmitting(status)
    const { error } = await evt.setRsvp(status)
    setRsvpSubmitting(null)
    if (error) {
      toast.error(error)
    } else {
      // Refresh badges (RSVP may have just earned the "I'm In" badge)
      badges.refresh()
      toast.success(
        status === 'going' ? "You're in! 🍗" :
        status === 'maybe' ? 'Marked as maybe' :
        'Marked as not going'
      )
    }
  }

  const handleDropOut = async () => {
    const { error } = await evt.removeRsvp()
    if (error) toast.error(error)
    else toast.success('RSVP removed')
  }

  const handleCheckIn = async (stop: EventStop) => {
    if (!userId) { toast.error('Sign in first'); return }
    if (evt.myRsvp?.status !== 'going') { toast.error("Join the crawl first before checking in!"); return }
    setCheckinSubmitting(stop.id)
    const { error } = await evt.checkIn(stop.id)
    setCheckinSubmitting(null)
    if (error) {
      // The DB rejects check-ins outside the event window (clock skew can
      // let the button render early) — translate the policy error.
      toast.error(error.includes('policy') ? `Check-ins unlock ${unlockLabel ?? 'on crawl day'} 🍗` : error)
    } else {
      badges.refresh()
      toast.success(`Checked in at ${stop.spot_name}! 🍗`)
    }
  }

  const handleAddReview = (stop: EventStop) => {
    if (evt.myRsvp?.status !== 'going') { toast.error('Join the crawl first!'); return }
    setReviewingStop(stop)
  }

  const handleSubmitReview = async (data: ReviewFormData) => {
    if (!reviewingStop) return { error: 'No stop selected' }
    if (evt.myRsvp?.status !== 'going') return { error: 'Join the crawl first before leaving a review!' }
    const result = await reviews.createReview(data, userId ?? '')
    if (!result.error) {
      // Ensure a checkin exists and link this review to it. The review is
      // already saved at this point, so a rejected check-in (e.g. outside the
      // event window) must be surfaced — silently swallowing it leaves the
      // user believing they're checked in when they aren't.
      if (result.reviewId) {
        const { error: checkinError } = await evt.checkIn(reviewingStop.id, result.reviewId)
        if (checkinError) {
          toast.error(
            checkinError.includes('policy')
              ? `Review saved, but check-ins for ${e.name} are closed — ask an admin.`
              : `Review saved, but check-in failed: ${checkinError}`,
            { duration: 6000 }
          )
        }
      }
      badges.refresh()
      setReviewingStop(null)
    }
    return { error: result.error }
  }

  // Open the EDIT modal for an existing review: fetch the full row + photos so
  // the form populates (the create form would otherwise open blank).
  const handleEditReview = async (reviewId: string) => {
    setLoadingReviewId(reviewId)
    const [{ data: row, error }, { data: photos }] = await Promise.all([
      supabase.from('reviews_with_profiles').select('*').eq('id', reviewId).maybeSingle(),
      supabase.from('review_photos').select('*').eq('review_id', reviewId).order('display_order'),
    ])
    setLoadingReviewId(null)
    if (error || !row) {
      toast.error('Could not load your review')
      return
    }
    setEditingReview({ ...(row as Review), photos: (photos ?? []) as ReviewPhoto[] })
  }

  const handleUpdateReview = async (data: Parameters<typeof reviews.updateReview>[1]) => {
    if (!editingReview) return
    const result = await reviews.updateReview(editingReview.id, data)
    if (result.error) {
      toast.error(result.error)
    } else {
      badges.refresh()
      await evt.refresh()
      setEditingReview(null)
      toast.success('Review updated')
    }
  }

  const hero = (
    <EventHero
      event={e}
      phase={phase}
      dateRange={dateRange}
      goingCount={goingCount}
      stopCount={Math.max(e.stop_count ?? 0, evt.stops.length)}
      isGoing={evt.myRsvp?.status === 'going'}
    />
  )
  const rsvpPanel = (
    <EventRsvpPanel
      signedIn={signedIn}
      myRsvp={evt.myRsvp}
      submitting={rsvpSubmitting}
      onRsvp={handleRsvp}
      onDropOut={handleDropOut}
    />
  )
  const route = (
    <EventRoute
      phase={phase}
      stops={evt.stops}
      signedIn={signedIn}
      checkedInStopIds={checkedInStopIds}
      myCheckins={evt.myCheckins}
      checkinSubmitting={checkinSubmitting}
      loadingReviewId={loadingReviewId}
      unlockLabel={unlockLabel}
      onCheckIn={handleCheckIn}
      onAddReview={handleAddReview}
      onEditReview={handleEditReview}
    />
  )
  const badgeSection = <EventBadges phase={phase} badges={eventBadges} />
  const whosComing = <WhosComing rsvps={evt.rsvps} signedIn={signedIn} goingCount={goingCount} />
  const checkedInFeed = signedIn ? (
    <CheckedInFeed
      attendees={checkinAttendees}
      totalStops={evt.stops.length}
      isAdmin={auth.isAdmin}
      resetConfirmUserId={resetConfirmUserId}
      resetingUserId={resetingUserId}
      onToggleResetConfirm={setResetConfirmUserId}
      onResetProgress={handleResetProgress}
    />
  ) : null

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{e.name} — WingKingTony</title>
      </Helmet>

      <AppHeader />

      {/* Sub-bar: share action; the title lives in the hero card (on mobile
          it would otherwise appear three times above the fold) */}
      <div className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <h1 className="font-display uppercase text-lg text-night-900 tracking-tightest flex-1 truncate hidden sm:block">{e.name}</h1>
          <span className="flex-1 sm:hidden text-[11px] font-extrabold uppercase tracking-crowd text-charcoal-500 truncate">
            {startsAt ? format(startsAt, 'EEE MMM d') : 'Date TBA'} · {goingCount} going
          </span>
          <ShareButton
            title={e.name}
            text={`Join me at ${e.name}! 🍗`}
            url={`${window.location.origin}/events/${e.slug}`}
          />
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {phase === 'announced' && (
          <>
            {hero}
            {rsvpPanel}
            {whosComing}
            {route}
            {badgeSection}
          </>
        )}

        {phase === 'route_live' && (
          <>
            {hero}
            {rsvpPanel}
            {route}
            {whosComing}
            {badgeSection}
          </>
        )}

        {phase === 'crawl_day' && (
          <>
            {signedIn && evt.myRsvp?.status === 'going' && (
              <EventProgress stops={evt.stops} checkedInStopIds={checkedInStopIds} />
            )}
            {hero}
            {!signedIn || evt.myRsvp?.status !== 'going' ? rsvpPanel : null}
            {route}
            {checkedInFeed}
            {badgeSection}
            {whosComing}
          </>
        )}

        {phase === 'wrapped' && (
          <>
            {hero}
            {signedIn ? (
              <EventRecap eventId={e.id} totalStops={evt.stops.length} totalCheckins={totalCheckins} />
            ) : (
              rsvpPanel
            )}
            {route}
            {signedIn && badgeSection}
          </>
        )}
      </main>

      {reviewingStop && (
        <ReviewFormModal
          onClose={() => setReviewingStop(null)}
          onSubmit={handleSubmitReview}
          prefill={{
            shop_name: reviewingStop.spot_name ?? '',
            address: reviewingStop.spot_address ?? '',
            lat: reviewingStop.spot_lat ?? 0,
            lng: reviewingStop.spot_lng ?? 0,
          }}
          eventContext={{
            event_id: e.id,
            event_stop_id: reviewingStop.id,
            event_name: e.name,
          }}
        />
      )}

      {editingReview && (
        <ReviewEditModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSubmit={handleUpdateReview}
        />
      )}
    </div>
  )
}
