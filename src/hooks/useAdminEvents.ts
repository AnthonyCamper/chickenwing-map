import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WingEvent, EventStop, EventFormData } from '../lib/types'

export interface UseAdminEventsReturn {
  events: WingEvent[]
  loading: boolean
  refresh: () => Promise<void>
  createEvent: (data: EventFormData) => Promise<{ error: string | null; eventId?: string }>
  updateEvent: (id: string, data: Partial<EventFormData>) => Promise<{ error: string | null }>
  deleteEvent: (id: string) => Promise<{ error: string | null }>
  addStop: (eventId: string, wingSpotId: string, opts?: { plannedArrival?: string | null; notes?: string | null }) => Promise<{ error: string | null }>
  removeStop: (stopId: string) => Promise<{ error: string | null }>
  reorderStops: (stops: { id: string; position: number }[]) => Promise<{ error: string | null }>
  loadStops: (eventId: string) => Promise<EventStop[]>
}

export function useAdminEvents(): UseAdminEventsReturn {
  const [events, setEvents] = useState<WingEvent[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('events_with_counts')
      .select('*')
      .order('created_at', { ascending: false })
    setEvents((data ?? []) as WingEvent[])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const createEvent = async (data: EventFormData): Promise<{ error: string | null; eventId?: string }> => {
    const { data: row, error } = await supabase
      .from('events')
      .insert({
        slug: data.slug.trim(),
        name: data.name.trim(),
        description: data.description?.trim() || null,
        cover_image_url: data.cover_image_url?.trim() || null,
        starts_at: data.starts_at || null,
        ends_at: data.ends_at || null,
        is_published: data.is_published,
      })
      .select('id')
      .single()
    if (error) return { error: error.message }
    await refresh()
    return { error: null, eventId: row.id }
  }

  const updateEvent = async (id: string, data: Partial<EventFormData>): Promise<{ error: string | null }> => {
    const updates: Record<string, unknown> = {}
    if (data.slug !== undefined) updates.slug = data.slug.trim()
    if (data.name !== undefined) updates.name = data.name.trim()
    if (data.description !== undefined) updates.description = data.description?.trim() || null
    if (data.cover_image_url !== undefined) updates.cover_image_url = data.cover_image_url?.trim() || null
    if (data.starts_at !== undefined) updates.starts_at = data.starts_at || null
    if (data.ends_at !== undefined) updates.ends_at = data.ends_at || null
    if (data.is_published !== undefined) updates.is_published = data.is_published
    const { error } = await supabase.from('events').update(updates).eq('id', id)
    if (error) return { error: error.message }
    await refresh()
    return { error: null }
  }

  const deleteEvent = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) return { error: error.message }
    await refresh()
    return { error: null }
  }

  const loadStops = async (eventId: string): Promise<EventStop[]> => {
    const { data } = await supabase
      .from('event_stops_with_spots')
      .select('*')
      .eq('event_id', eventId)
      .order('position', { ascending: true })
    return (data ?? []) as EventStop[]
  }

  const addStop = async (
    eventId: string,
    wingSpotId: string,
    opts: { plannedArrival?: string | null; notes?: string | null } = {}
  ): Promise<{ error: string | null }> => {
    // Next position = max(position) + 1
    const { data: existing } = await supabase
      .from('event_stops')
      .select('position')
      .eq('event_id', eventId)
      .order('position', { ascending: false })
      .limit(1)
    const nextPos = (existing?.[0]?.position ?? -1) + 1
    const { error } = await supabase
      .from('event_stops')
      .insert({
        event_id: eventId,
        wing_spot_id: wingSpotId,
        position: nextPos,
        planned_arrival: opts.plannedArrival ?? null,
        notes: opts.notes ?? null,
      })
    if (error) return { error: error.message }
    return { error: null }
  }

  const removeStop = async (stopId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from('event_stops').delete().eq('id', stopId)
    if (error) return { error: error.message }
    return { error: null }
  }

  const reorderStops = async (
    stops: { id: string; position: number }[]
  ): Promise<{ error: string | null }> => {
    // Two-phase swap: bump every position by 1000 first, then assign final
    // values. Avoids violating any future UNIQUE(event_id, position) on the fly.
    for (const s of stops) {
      const { error } = await supabase
        .from('event_stops')
        .update({ position: s.position + 1000 })
        .eq('id', s.id)
      if (error) return { error: error.message }
    }
    for (const s of stops) {
      const { error } = await supabase
        .from('event_stops')
        .update({ position: s.position })
        .eq('id', s.id)
      if (error) return { error: error.message }
    }
    return { error: null }
  }

  return {
    events,
    loading,
    refresh,
    createEvent,
    updateEvent,
    deleteEvent,
    addStop,
    removeStop,
    reorderStops,
    loadStops,
  }
}
