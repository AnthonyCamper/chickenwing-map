import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  WingEvent,
  EventStop,
  EventRsvp,
  EventCheckin,
  RsvpStatus,
} from '../lib/types'

export interface UseEventReturn {
  event: WingEvent | null
  stops: EventStop[]
  myRsvp: EventRsvp | null
  myCheckins: EventCheckin[]
  rsvps: EventRsvp[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  setRsvp: (status: RsvpStatus, opts?: { guestCount?: number; notes?: string }) => Promise<{ error: string | null }>
  removeRsvp: () => Promise<{ error: string | null }>
  checkIn: (stopId: string, reviewId?: string | null) => Promise<{ error: string | null }>
  removeCheckIn: (stopId: string) => Promise<{ error: string | null }>
  attachReviewToCheckIn: (stopId: string, reviewId: string) => Promise<void>
}

/**
 * Fetches a single event by slug — or, when slug is omitted, the
 * earliest-upcoming published event (or most recent if none upcoming).
 * Loads stops, the current user's RSVP, and their check-ins.
 */
export function useEvent(slug: string | null | undefined, userId: string | null | undefined): UseEventReturn {
  const [event, setEvent] = useState<WingEvent | null>(null)
  const [stops, setStops] = useState<EventStop[]>([])
  const [myRsvp, setMyRsvp] = useState<EventRsvp | null>(null)
  const [myCheckins, setMyCheckins] = useState<EventCheckin[]>([])
  const [rsvps, setRsvps] = useState<EventRsvp[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Resolve the event
      let evtRow: WingEvent | null = null
      if (slug) {
        const { data, error: e } = await supabase
          .from('events_with_counts')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()
        if (e) throw new Error(e.message)
        evtRow = (data as WingEvent | null) ?? null
      } else {
        // Active event = earliest upcoming, fallback to most recent past
        const now = new Date().toISOString()
        const { data: upcoming } = await supabase
          .from('events_with_counts')
          .select('*')
          .eq('is_published', true)
          .or(`ends_at.gte.${now},ends_at.is.null`)
          .order('starts_at', { ascending: true, nullsFirst: false })
          .limit(1)
        if (upcoming && upcoming.length > 0) {
          evtRow = upcoming[0] as WingEvent
        } else {
          const { data: past } = await supabase
            .from('events_with_counts')
            .select('*')
            .eq('is_published', true)
            .order('starts_at', { ascending: false, nullsFirst: false })
            .limit(1)
          evtRow = (past?.[0] as WingEvent | null) ?? null
        }
      }

      if (!evtRow) {
        setEvent(null)
        setStops([])
        setMyRsvp(null)
        setMyCheckins([])
        setRsvps([])
        setLoading(false)
        return
      }
      setEvent(evtRow)

      const [stopsRes, rsvpsRes, checkinsRes] = await Promise.all([
        supabase
          .from('event_stops_with_spots')
          .select('*')
          .eq('event_id', evtRow.id)
          .order('position', { ascending: true }),
        supabase
          .from('event_rsvps_with_profiles')
          .select('*')
          .eq('event_id', evtRow.id),
        userId
          ? supabase
              .from('event_checkins')
              .select('*')
              .eq('event_id', evtRow.id)
              .eq('user_id', userId)
          : Promise.resolve({ data: [] as EventCheckin[], error: null }),
      ])

      if (stopsRes.error) throw new Error(stopsRes.error.message)
      setStops((stopsRes.data ?? []) as EventStop[])

      const allRsvps = (rsvpsRes.data ?? []) as EventRsvp[]
      setRsvps(allRsvps)
      setMyRsvp(userId ? allRsvps.find(r => r.user_id === userId) ?? null : null)

      setMyCheckins((checkinsRes.data ?? []) as EventCheckin[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load event')
    } finally {
      setLoading(false)
    }
  }, [slug, userId])

  useEffect(() => { fetchAll() }, [fetchAll])

  const setRsvp = async (
    status: RsvpStatus,
    opts: { guestCount?: number; notes?: string } = {}
  ): Promise<{ error: string | null }> => {
    if (!event || !userId) return { error: 'Not signed in' }
    const { error: e } = await supabase
      .from('event_rsvps')
      .upsert(
        {
          event_id: event.id,
          user_id: userId,
          status,
          guest_count: opts.guestCount ?? 0,
          notes: opts.notes ?? null,
        },
        { onConflict: 'event_id,user_id' }
      )
    if (e) return { error: e.message }
    await fetchAll()
    return { error: null }
  }

  const removeRsvp = async (): Promise<{ error: string | null }> => {
    if (!event || !userId) return { error: 'Not signed in' }
    const { error: e } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('event_id', event.id)
      .eq('user_id', userId)
    if (e) return { error: e.message }
    await fetchAll()
    return { error: null }
  }

  const checkIn = async (
    stopId: string,
    reviewId: string | null = null
  ): Promise<{ error: string | null }> => {
    if (!event || !userId) return { error: 'Not signed in' }
    const { error: e } = await supabase
      .from('event_checkins')
      .upsert(
        {
          event_id: event.id,
          event_stop_id: stopId,
          user_id: userId,
          review_id: reviewId,
        },
        { onConflict: 'event_stop_id,user_id' }
      )
    if (e) return { error: e.message }
    await fetchAll()
    return { error: null }
  }

  const removeCheckIn = async (stopId: string): Promise<{ error: string | null }> => {
    if (!event || !userId) return { error: 'Not signed in' }
    const { error: e } = await supabase
      .from('event_checkins')
      .delete()
      .eq('event_stop_id', stopId)
      .eq('user_id', userId)
    if (e) return { error: e.message }
    await fetchAll()
    return { error: null }
  }

  const attachReviewToCheckIn = async (stopId: string, reviewId: string): Promise<void> => {
    if (!userId) return
    await supabase
      .from('event_checkins')
      .update({ review_id: reviewId })
      .eq('event_stop_id', stopId)
      .eq('user_id', userId)
    await fetchAll()
  }

  return {
    event,
    stops,
    myRsvp,
    myCheckins,
    rsvps,
    loading,
    error,
    refresh: fetchAll,
    setRsvp,
    removeRsvp,
    checkIn,
    removeCheckIn,
    attachReviewToCheckIn,
  }
}
