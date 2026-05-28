import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdminEvents } from '../../hooks/useAdminEvents'
import BusinessAutocomplete from '../ui/BusinessAutocomplete'
import CoverImagePicker from '../ui/CoverImagePicker'
import type { WingEvent, EventStop, EventFormData, WingSpot } from '../../lib/types'

async function uploadEventCover(slug: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${slug}/cover.${ext}`
  const { error } = await supabase.storage
    .from('event-covers')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) {
    toast.error('Cover upload failed: ' + error.message)
    return null
  }
  const { data } = supabase.storage.from('event-covers').getPublicUrl(path)
  return data.publicUrl
}

function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
}

export default function AdminEventsTab() {
  const events = useAdminEvents()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (events.loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
      </div>
    )
  }

  if (editingId) {
    const evt = events.events.find(e => e.id === editingId)
    if (!evt) {
      setEditingId(null)
      return null
    }
    return (
      <EventEditor
        event={evt}
        onBack={() => { setEditingId(null); events.refresh() }}
        onDelete={async () => {
          if (!confirm(`Delete "${evt.name}" and all its stops, RSVPs, check-ins, and badges?`)) return
          const { error } = await events.deleteEvent(evt.id)
          if (error) toast.error(error)
          else { toast.success('Event deleted'); setEditingId(null) }
        }}
        admin={events}
      />
    )
  }

  if (creating) {
    return (
      <NewEventForm
        onCreate={async (data) => {
          const result = await events.createEvent(data)
          if (result.error) {
            toast.error(result.error)
          } else {
            toast.success('Event created — now add stops!')
            setCreating(false)
            if (result.eventId) setEditingId(result.eventId)
          }
        }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-charcoal-800">Events</h2>
        <button onClick={() => setCreating(true)} className="btn-primary px-3 py-1.5 text-xs">
          + New event
        </button>
      </div>

      {events.events.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-4xl mb-3">🍗</p>
          <p className="font-medium text-charcoal-600 mb-1">No events yet</p>
          <p className="text-xs text-charcoal-400">Create one to kick off your first crawl.</p>
        </div>
      ) : (
        events.events.map(e => (
          <button
            key={e.id}
            onClick={() => setEditingId(e.id)}
            className="card px-5 py-4 w-full text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-charcoal-800 truncate">{e.name}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                    e.is_published
                      ? 'bg-green-100 text-green-700'
                      : 'bg-warmgray-200 text-charcoal-500'
                  }`}>
                    {e.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="text-xs text-charcoal-400 truncate">/events/{e.slug}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-charcoal-400">
                  <span>📍 {e.stop_count ?? 0} stops</span>
                  <span>👥 {e.going_count ?? 0} going</span>
                </div>
              </div>
              <span className="text-amber-400">→</span>
            </div>
          </button>
        ))
      )}
    </div>
  )
}

// ── New event form ─────────────────────────────────────────────────────────

interface NewEventFormProps {
  onCreate: (data: EventFormData) => Promise<void>
  onCancel: () => void
}

function NewEventForm({ onCreate, onCancel }: NewEventFormProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const slugAuto = slugify(name)

  const handleCoverChange = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }
    setSubmitting(true)
    const finalSlug = (slug || slugAuto).trim()
    let coverImageUrl: string | undefined
    if (coverFile) {
      const url = await uploadEventCover(finalSlug, coverFile)
      if (url) coverImageUrl = url
    }
    await onCreate({
      name,
      slug: finalSlug,
      description,
      cover_image_url: coverImageUrl,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_published: isPublished,
    })
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="card px-5 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-charcoal-800">New event</h2>
        <button type="button" onClick={onCancel} className="btn-ghost text-xs text-charcoal-400">Cancel</button>
      </div>

      <div>
        <label className="label">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="2026 WingKingTony ChickenWing Crawl of DC"
          className="input"
          required
        />
      </div>

      <div>
        <label className="label">Slug (URL)</label>
        <input
          type="text"
          value={slug}
          onChange={e => setSlug(slugify(e.target.value))}
          placeholder={slugAuto || 'dc-crawl-2026'}
          className="input"
        />
        <p className="text-xs text-charcoal-400 mt-1">
          /events/{slug || slugAuto || 'your-slug'}
        </p>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={4}
          className="input resize-none"
          placeholder="What's the vibe? How does the crawl work?"
        />
      </div>

      <CoverImagePicker
        preview={coverPreview}
        onChange={handleCoverChange}
        onClear={() => { setCoverFile(null); setCoverPreview(null) }}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Starts</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={e => setStartsAt(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Ends</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={e => setEndsAt(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={e => setIsPublished(e.target.checked)}
          className="w-4 h-4 rounded accent-amber-400"
        />
        <span className="text-sm text-charcoal-600 font-medium">
          Publish (visible to all approved users)
        </span>
      </label>

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? 'Creating…' : 'Create event'}
      </button>
    </form>
  )
}

// ── Event editor (edit details + manage stops) ─────────────────────────────

interface EventEditorProps {
  event: WingEvent
  onBack: () => void
  onDelete: () => void
  admin: ReturnType<typeof useAdminEvents>
}

function EventEditor({ event, onBack, onDelete, admin }: EventEditorProps) {
  const [name, setName] = useState(event.name)
  const [description, setDescription] = useState(event.description ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(event.cover_image_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState(event.starts_at?.slice(0, 16) ?? '')
  const [endsAt, setEndsAt] = useState(event.ends_at?.slice(0, 16) ?? '')
  const [isPublished, setIsPublished] = useState(event.is_published)
  const [saving, setSaving] = useState(false)

  const handleCoverChange = (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  const [stops, setStops] = useState<EventStop[]>([])
  const [stopsLoading, setStopsLoading] = useState(true)
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null)
  const [stopEdits, setStopEdits] = useState<Record<string, { notes: string; parking_notes: string; planned_arrival: string }>>({})
  const [savingStopId, setSavingStopId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setStopsLoading(true)
      const s = await admin.loadStops(event.id)
      if (!cancelled) {
        setStops(s)
        setStopsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [event.id, admin])

  const reloadStops = async () => {
    const s = await admin.loadStops(event.id)
    setStops(s)
  }

  const handleSave = async () => {
    setSaving(true)
    let finalCoverUrl = coverImageUrl
    if (coverFile) {
      const url = await uploadEventCover(event.slug, coverFile)
      if (url) {
        finalCoverUrl = url
        setCoverImageUrl(url)
        setCoverFile(null)
        setCoverPreview(null)
      }
    }
    const { error } = await admin.updateEvent(event.id, {
      slug: event.slug,
      name,
      description,
      cover_image_url: finalCoverUrl,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      is_published: isPublished,
    })
    setSaving(false)
    if (error) toast.error(error)
    else toast.success('Event saved')
  }

  const moveStop = async (idx: number, dir: -1 | 1) => {
    const next = idx + dir
    if (next < 0 || next >= stops.length) return
    const reordered = [...stops]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    const positionsUpdate = reordered.map((s, i) => ({ id: s.id, position: i }))
    setStops(reordered.map((s, i) => ({ ...s, position: i })))
    const { error } = await admin.reorderStops(positionsUpdate)
    if (error) {
      toast.error('Reorder failed')
      await reloadStops()
    }
  }

  const removeStop = async (stopId: string) => {
    if (!confirm('Remove this stop from the route?')) return
    const { error } = await admin.removeStop(stopId)
    if (error) toast.error(error)
    else await reloadStops()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost text-sm text-charcoal-500">← Back to events</button>
        <button onClick={onDelete} className="btn-danger px-3 py-1.5 text-xs">Delete event</button>
      </div>

      <div className="card px-5 py-5 space-y-4">
        <h2 className="font-display text-lg text-charcoal-800">Event details</h2>

        <div>
          <label className="label">Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            className="input resize-none"
          />
        </div>

        <CoverImagePicker
          preview={coverPreview ?? coverImageUrl}
          onChange={handleCoverChange}
          onClear={() => {
            setCoverFile(null)
            setCoverPreview(null)
            setCoverImageUrl('')
          }}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starts</label>
            <input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Ends</label>
            <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} className="input" />
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={e => setIsPublished(e.target.checked)}
            className="w-4 h-4 rounded accent-amber-400"
          />
          <span className="text-sm text-charcoal-600 font-medium">Published</span>
        </label>

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div className="card px-5 py-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-charcoal-800">The route</h2>
          <span className="text-xs text-charcoal-400">{stops.length} stops</span>
        </div>

        {stopsLoading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 rounded-full border-2 border-amber-300 border-t-amber-400 animate-spin" />
          </div>
        ) : stops.length === 0 ? (
          <p className="text-sm text-charcoal-400 italic text-center py-3">No stops yet.</p>
        ) : (
          <ol className="space-y-2">
            {stops.map((s, idx) => {
              const isExpanded = expandedStopId === s.id
              const edit = stopEdits[s.id] ?? {
                notes: s.notes ?? '',
                parking_notes: s.parking_notes ?? '',
                planned_arrival: s.planned_arrival ? new Date(s.planned_arrival).toISOString().slice(0, 16) : '',
              }
              const setEdit = (patch: Partial<typeof edit>) =>
                setStopEdits(prev => ({ ...prev, [s.id]: { ...edit, ...patch } }))

              return (
                <li key={s.id} className="rounded-2xl bg-warmgray-50 border border-warmgray-200 overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-7 h-7 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </div>
                    <button
                      onClick={() => setExpandedStopId(isExpanded ? null : s.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-semibold text-sm text-charcoal-700 truncate">{s.spot_name}</p>
                      <p className="text-xs text-charcoal-400 truncate">{s.spot_address}</p>
                      {s.parking_notes && (
                        <p className="text-xs text-amber-600 truncate mt-0.5">🅿️ {s.parking_notes}</p>
                      )}
                    </button>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => moveStop(idx, -1)}
                        disabled={idx === 0}
                        className="w-7 h-7 rounded-lg hover:bg-warmgray-200 disabled:opacity-30 flex items-center justify-center"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => moveStop(idx, 1)}
                        disabled={idx === stops.length - 1}
                        className="w-7 h-7 rounded-lg hover:bg-warmgray-200 disabled:opacity-30 flex items-center justify-center"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeStop(s.id)}
                        className="w-7 h-7 rounded-lg hover:bg-red-100 text-red-500 flex items-center justify-center"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-warmgray-200 px-3 pb-3 pt-2 space-y-2">
                      <div>
                        <label className="label text-xs">Parking instructions</label>
                        <textarea
                          value={edit.parking_notes}
                          onChange={e => setEdit({ parking_notes: e.target.value })}
                          rows={2}
                          className="input resize-none text-sm"
                          placeholder="e.g. Free street parking on Main St, garage on 2nd Ave ($5)"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Notes</label>
                        <textarea
                          value={edit.notes}
                          onChange={e => setEdit({ notes: e.target.value })}
                          rows={2}
                          className="input resize-none text-sm"
                          placeholder="Any notes for this stop…"
                        />
                      </div>
                      <div>
                        <label className="label text-xs">Planned arrival</label>
                        <input
                          type="datetime-local"
                          value={edit.planned_arrival}
                          onChange={e => setEdit({ planned_arrival: e.target.value })}
                          className="input text-sm"
                        />
                      </div>
                      <button
                        onClick={async () => {
                          setSavingStopId(s.id)
                          const { error } = await admin.updateStop(s.id, {
                            parking_notes: edit.parking_notes.trim() || null,
                            notes: edit.notes.trim() || null,
                            planned_arrival: edit.planned_arrival || null,
                          })
                          setSavingStopId(null)
                          if (error) toast.error(error)
                          else {
                            toast.success('Stop updated')
                            await reloadStops()
                            setExpandedStopId(null)
                          }
                        }}
                        disabled={savingStopId === s.id}
                        className="btn-primary w-full text-xs py-2"
                      >
                        {savingStopId === s.id ? 'Saving…' : 'Save stop'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}

        <AddStopForm
          eventId={event.id}
          existingSpotIds={new Set(stops.map(s => s.wing_spot_id))}
          onAdded={reloadStops}
          admin={admin}
        />
      </div>
    </div>
  )
}

// ── Add stop form ──────────────────────────────────────────────────────────

interface AddStopFormProps {
  eventId: string
  existingSpotIds: Set<string>
  onAdded: () => Promise<void>
  admin: ReturnType<typeof useAdminEvents>
}

function AddStopForm({ eventId, existingSpotIds, onAdded, admin }: AddStopFormProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [existingSpots, setExistingSpots] = useState<WingSpot[]>([])
  const [selectedSpotId, setSelectedSpotId] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  // New-spot fields
  const [newName, setNewName] = useState('')
  const [newAddr, setNewAddr] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')

  useEffect(() => {
    supabase
      .from('wing_spots')
      .select('*')
      .order('name')
      .then(({ data }) => setExistingSpots((data ?? []) as WingSpot[]))
  }, [])

  const availableSpots = existingSpots
    .filter(s => !existingSpotIds.has(s.id))
    .filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()))

  const handleAddExisting = async () => {
    if (!selectedSpotId) { toast.error('Pick a spot first'); return }
    setBusy(true)
    const { error } = await admin.addStop(eventId, selectedSpotId)
    setBusy(false)
    if (error) toast.error(error)
    else {
      setSelectedSpotId('')
      setSearch('')
      await onAdded()
      toast.success('Stop added')
    }
  }

  const handleAddNew = async () => {
    if (!newName.trim() || !newAddr.trim() || !newLat || !newLng) {
      toast.error('Fill in name, address, and coordinates')
      return
    }
    setBusy(true)
    const { data: spot, error: spotErr } = await supabase
      .from('wing_spots')
      .upsert(
        {
          name: newName.trim(),
          address: newAddr.trim(),
          lat: parseFloat(newLat),
          lng: parseFloat(newLng),
        },
        { onConflict: 'name,address', ignoreDuplicates: false }
      )
      .select('id')
      .single()
    if (spotErr || !spot) {
      setBusy(false)
      toast.error(spotErr?.message ?? 'Could not create wing spot')
      return
    }
    const { error } = await admin.addStop(eventId, spot.id)
    setBusy(false)
    if (error) toast.error(error)
    else {
      setNewName(''); setNewAddr(''); setNewLat(''); setNewLng('')
      await onAdded()
      toast.success('Stop added')
    }
  }

  return (
    <div className="border-t border-warmgray-100 pt-4 space-y-3">
      <div className="flex gap-1 p-1 bg-warmgray-100 rounded-xl">
        <button
          onClick={() => setMode('existing')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'existing' ? 'bg-white shadow-soft text-charcoal-700' : 'text-charcoal-400'
          }`}
        >
          Existing spot
        </button>
        <button
          onClick={() => setMode('new')}
          className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            mode === 'new' ? 'bg-white shadow-soft text-charcoal-700' : 'text-charcoal-400'
          }`}
        >
          New spot
        </button>
      </div>

      {mode === 'existing' ? (
        <>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search wing spots…"
            className="input"
          />
          <select
            value={selectedSpotId}
            onChange={e => setSelectedSpotId(e.target.value)}
            className="input"
          >
            <option value="">Pick a spot ({availableSpots.length} available)…</option>
            {availableSpots.map(s => (
              <option key={s.id} value={s.id}>{s.name} — {s.address}</option>
            ))}
          </select>
          <button onClick={handleAddExisting} disabled={busy || !selectedSpotId} className="btn-primary w-full text-sm">
            {busy ? 'Adding…' : '+ Add stop'}
          </button>
        </>
      ) : (
        <>
          <BusinessAutocomplete
            value={newName}
            onChange={setNewName}
            onSelect={s => {
              setNewName(s.name)
              setNewAddr(s.address)
              setNewLat(parseFloat(s.lat).toFixed(6))
              setNewLng(parseFloat(s.lng).toFixed(6))
            }}
            placeholder="Search for a place…"
          />
          <input
            type="text"
            value={newAddr}
            onChange={e => setNewAddr(e.target.value)}
            placeholder="Address"
            className="input"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              value={newLat}
              onChange={e => setNewLat(e.target.value)}
              placeholder="Lat"
              className="input"
            />
            <input
              type="number"
              step="any"
              value={newLng}
              onChange={e => setNewLng(e.target.value)}
              placeholder="Lng"
              className="input"
            />
          </div>
          <button onClick={handleAddNew} disabled={busy} className="btn-primary w-full text-sm">
            {busy ? 'Adding…' : '+ Add new stop'}
          </button>
        </>
      )}
    </div>
  )
}

