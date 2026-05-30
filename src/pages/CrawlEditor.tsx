import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import {
  createCrawl,
  updateCrawl,
  deleteCrawl,
  addCrawlItem,
  removeCrawlItem,
  updateCrawlItemNote,
  reorderCrawlItems,
  uploadCrawlCover,
} from '../lib/crawlActions'
import AppHeader from '../components/AppHeader'
import PageStateShell from '../components/ui/PageStateShell'
import BusinessAutocomplete from '../components/ui/BusinessAutocomplete'
import CrawlRouteMap from '../components/ui/CrawlRouteMap'
import CrawlOwnerToolbar from '../components/ui/CrawlOwnerToolbar'
import CoverImagePicker from '../components/ui/CoverImagePicker'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { WingCrawl, WingCrawlItem, WingSpot } from '../lib/types'

interface ItemWithSpot extends WingCrawlItem {
  spot: WingSpot | null
}

export default function CrawlEditor() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const isNew = !id

  const [authChecked, setAuthChecked] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [crawl, setCrawl] = useState<WingCrawl | null>(null)
  const [items, setItems] = useState<ItemWithSpot[]>([])
  const [loading, setLoading] = useState(!isNew)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [isRanked, setIsRanked] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)

  // Auth gate
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      const ok = !!session?.user
      setAuthed(ok)
      setUserId(session?.user?.id ?? '')
      setAuthChecked(true)
      if (!ok) navigate('/login', { replace: true })
    })
    return () => { cancelled = true }
  }, [navigate])

  // Load existing crawl when editing
  const load = useCallback(async () => {
    if (isNew || !id) return
    setLoading(true)

    const { data: c, error } = await supabase
      .from('wing_crawls')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !c) {
      toast.error('List not found')
      navigate('/', { replace: true })
      return
    }

    const crawlRow = c as WingCrawl
    setCrawl(crawlRow)
    setTitle(crawlRow.title)
    setDescription(crawlRow.description ?? '')
    setIsPublic(crawlRow.is_public)
    setIsRanked(crawlRow.is_ranked)

    const { data: itemRows } = await supabase
      .from('wing_crawl_items')
      .select('*')
      .eq('crawl_id', crawlRow.id)
      .order('position', { ascending: true })

    const itemList = (itemRows ?? []) as WingCrawlItem[]
    const spotIds = itemList.map(i => i.wing_spot_id)
    const { data: spots } = spotIds.length
      ? await supabase.from('wing_spots').select('*').in('id', spotIds)
      : { data: [] }
    const spotsById: Record<string, WingSpot> = {}
    for (const s of (spots ?? []) as WingSpot[]) spotsById[s.id] = s

    setItems(itemList.map(it => ({ ...it, spot: spotsById[it.wing_spot_id] ?? null })))
    setLoading(false)
  }, [id, isNew, navigate])

  useEffect(() => { load() }, [load])

  const metaDirty = !!crawl && (
    title !== crawl.title
    || description !== (crawl.description ?? '')
    || isRanked !== crawl.is_ranked
    || isPublic !== crawl.is_public
  )

  // Warn before unloading the tab while there are unsaved meta changes.
  useEffect(() => {
    if (!metaDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [metaDirty])

  function handleDiscardMeta() {
    if (!crawl) return
    setTitle(crawl.title)
    setDescription(crawl.description ?? '')
    setIsRanked(crawl.is_ranked)
    setIsPublic(crawl.is_public)
  }

  async function handleSaveMeta() {
    if (!title.trim()) { toast.error('Title is required'); return }
    setSavingMeta(true)
    try {
      if (isNew) {
        if (!userId) { toast.error('Not signed in'); return }
        const result = await createCrawl({
          title, description, is_public: isPublic, is_ranked: isRanked,
        }, userId)
        if (result.error || !result.crawl) {
          toast.error(result.error ?? 'Could not create'); return
        }
        toast.success('List created')
        navigate(`/lists/${result.crawl.id}/edit`, { replace: true })
      } else if (crawl) {
        const result = await updateCrawl(crawl.id, {
          title, description, is_public: isPublic, is_ranked: isRanked,
        })
        if (result.error) { toast.error(result.error); return }
        toast.success('Saved')
        setCrawl({ ...crawl, title, description, is_public: isPublic, is_ranked: isRanked })
      }
    } finally {
      setSavingMeta(false)
    }
  }

  async function handleDeleteCrawl() {
    if (!crawl) return
    const { error } = await deleteCrawl(crawl.id)
    if (error) { toast.error(error); return }
    toast.success('Deleted')
    navigate('/', { replace: true })
  }

  async function handleCoverChange(file: File) {
    if (!crawl) return
    const toastId = toast.loading('Uploading cover…')
    const { error, url } = await uploadCrawlCover(crawl.id, userId, file)
    toast.dismiss(toastId)
    if (error) { toast.error(error); return }
    if (url) {
      setCrawl({ ...crawl, cover_image_url: url })
      toast.success('Cover updated')
    }
  }

  async function handleClearCover() {
    if (!crawl) return
    const { error } = await updateCrawl(crawl.id, { cover_image_url: null })
    if (error) { toast.error(error); return }
    setCrawl({ ...crawl, cover_image_url: null })
    toast.success('Cover removed')
  }

  async function handleAddSpot(spotId: string) {
    if (!crawl) return
    if (items.some(i => i.wing_spot_id === spotId)) {
      toast('Already in this list', { icon: '👀' }); return
    }
    const { error } = await addCrawlItem(crawl.id, spotId)
    if (error) { toast.error(error); return }
    await load()
    toast.success('Spot added')
  }

  async function handleRemoveItem(itemId: string) {
    const { error } = await removeCrawlItem(itemId)
    if (error) { toast.error(error); return }
    setItems(items.filter(i => i.id !== itemId))
  }

  async function handleSaveNote(itemId: string, note: string) {
    const { error } = await updateCrawlItemNote(itemId, note)
    if (error) { toast.error(error); return }
    setItems(items.map(i => i.id === itemId ? { ...i, note: note.trim() || null } : i))
  }

  async function applyReorder(prev: ItemWithSpot[], next: ItemWithSpot[]) {
    setItems(next)
    const { error } = await reorderCrawlItems(next.map(i => i.id))
    if (error) {
      toast.error(error)
      await load()
      return
    }
    toast(
      t => (
        <span className="flex items-center gap-3">
          <span>Reordered</span>
          <button
            onClick={async () => {
              toast.dismiss(t.id)
              setItems(prev)
              const { error: undoErr } = await reorderCrawlItems(prev.map(i => i.id))
              if (undoErr) { toast.error(undoErr); await load() }
            }}
            className="font-extrabold uppercase tracking-crowd text-sauce-300 hover:text-sauce-200"
          >
            Undo
          </button>
        </span>
      ),
      { duration: 5000 }
    )
  }

  async function handleMove(itemId: string, direction: -1 | 1) {
    const idx = items.findIndex(i => i.id === itemId)
    const newIdx = idx + direction
    if (idx < 0 || newIdx < 0 || newIdx >= items.length) return
    const next = [...items]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    await applyReorder(items, next)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(items, oldIdx, newIdx)
    await applyReorder(items, next)
  }

  if (!authChecked || loading) {
    return (
      <PageStateShell>
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </PageStateShell>
    )
  }
  if (!authed) return null

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{isNew ? 'New list' : `Edit: ${crawl?.title ?? 'List'}`} — WingKingTony</title>
      </Helmet>

      <AppHeader />

      {!isNew && crawl && (
        <CrawlOwnerToolbar
          mode="edit"
          viewHref={`/lists/${crawl.slug}`}
          editHref={`/lists/${crawl.id}/edit`}
          onDelete={handleDeleteCrawl}
        />
      )}

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow mb-1">{isNew ? 'New list' : 'Editing'}</p>
            <h1 className="font-display uppercase text-3xl text-night-900 leading-none tracking-tightest">
              {isNew ? 'Start a new list' : crawl?.title ?? 'List'}
            </h1>
          </div>
          {metaDirty && (
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-night-900 bg-gold-300 text-night-900 text-[10px] font-extrabold uppercase tracking-crowd shadow-sticker-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-night-900 animate-pulse" />
              Unsaved
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 pb-32 sm:pb-safe-8 space-y-5">
        {/* ── List details ─────────────────────────────────────────── */}
        <div className="card px-5 py-5 space-y-4">
          <h2 className="font-display text-lg text-charcoal-800">List details</h2>

          <div>
            <label className="label">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Best hot wings in Brooklyn 2026"
              maxLength={120}
              className="input"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Why this list? What's the through-line?"
              rows={3}
              maxLength={600}
              className="input resize-none"
            />
            <p className="mt-1 text-[11px] text-charcoal-400">{description.length} / 600</p>
          </div>

          {!isNew && crawl && (
            <CoverImagePicker
              preview={crawl.cover_image_url}
              onChange={handleCoverChange}
              onClear={handleClearCover}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="card-soft px-3 py-2.5 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRanked}
                onChange={e => setIsRanked(e.target.checked)}
                className="w-4 h-4 rounded accent-sauce-400"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-night-800">Ranked</p>
                <p className="text-[11px] text-charcoal-400 leading-tight">Numbered top → bottom</p>
              </div>
            </label>
            <label className="card-soft px-3 py-2.5 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="w-4 h-4 rounded accent-sauce-400"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-night-800">Public</p>
                <p className="text-[11px] text-charcoal-400 leading-tight">Shareable link</p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveMeta}
              disabled={savingMeta || !title.trim()}
              className="btn-primary px-5 disabled:opacity-50"
            >
              {savingMeta ? 'Saving…' : isNew ? 'Create list' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* ── Spots ────────────────────────────────────────────────── */}
        {!isNew && crawl && (
          <div className="card px-5 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg text-charcoal-800">Spots</h2>
              <span className="text-xs text-charcoal-400">
                {items.length} {items.length === 1 ? 'spot' : 'spots'}
              </span>
            </div>

            {items.length > 0 && (
              <CrawlRouteMap
                items={items}
                ranked={isRanked}
                className="w-full h-48 sm:h-56 rounded-2xl border-2 border-night-900/10 overflow-hidden"
              />
            )}

            {items.length === 0 ? (
              <p className="text-sm text-charcoal-400 italic text-center py-3">
                No spots yet — add some below.
              </p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <ol className="space-y-2">
                    {items.map((item, idx) => (
                      <ItemEditor
                        key={item.id}
                        item={item}
                        rank={isRanked ? idx + 1 : null}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < items.length - 1}
                        onMoveUp={() => handleMove(item.id, -1)}
                        onMoveDown={() => handleMove(item.id, 1)}
                        onRemove={() => handleRemoveItem(item.id)}
                        onSaveNote={(note) => handleSaveNote(item.id, note)}
                      />
                    ))}
                  </ol>
                </SortableContext>
              </DndContext>
            )}

            <AddSpotForm
              existingSpotIds={new Set(items.map(i => i.wing_spot_id))}
              onAdded={handleAddSpot}
            />
          </div>
        )}
      </main>

      {/* Sticky save bar — appears when meta is dirty (edit mode only) */}
      {!isNew && metaDirty && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-night-900 bg-cream-100/95 backdrop-blur supports-[backdrop-filter]:bg-cream-100/85 shadow-[0_-2px_0_0_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="max-w-3xl mx-auto px-5 py-3 flex items-center gap-3">
            <span className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-500">
              Unsaved changes
            </span>
            <button
              onClick={handleDiscardMeta}
              disabled={savingMeta}
              className="btn-ghost ml-auto text-xs"
            >
              Discard
            </button>
            <button
              onClick={handleSaveMeta}
              disabled={savingMeta || !title.trim()}
              className="btn-primary px-5 disabled:opacity-50"
            >
              {savingMeta ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ─── Add spot form (existing or new) ─────────────────────────────────────────

function AddSpotForm({
  existingSpotIds, onAdded,
}: {
  existingSpotIds: Set<string>
  onAdded: (spotId: string) => void
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  // Existing-mode state
  const [search, setSearch] = useState('')
  const [existingResults, setExistingResults] = useState<WingSpot[]>([])
  const [searching, setSearching] = useState(false)

  // New-mode state
  const [newName, setNewName] = useState('')
  const [newAddr, setNewAddr] = useState('')
  const [newLat, setNewLat] = useState('')
  const [newLng, setNewLng] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (mode !== 'existing' || search.trim().length < 2) { setExistingResults([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('wing_spots')
        .select('*')
        .ilike('name', `%${search.trim()}%`)
        .order('name')
        .limit(20)
      if (cancelled) return
      setExistingResults((data ?? []) as WingSpot[])
      setSearching(false)
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [search, mode])

  async function handleCreateAndAdd() {
    if (!newName.trim() || !newAddr.trim() || !newLat || !newLng) {
      toast.error('Pick from the autocomplete or fill in all fields'); return
    }
    setCreating(true)
    const { data: spot, error } = await supabase
      .from('wing_spots')
      .upsert(
        { name: newName.trim(), address: newAddr.trim(), lat: parseFloat(newLat), lng: parseFloat(newLng) },
        { onConflict: 'name,address', ignoreDuplicates: false }
      )
      .select('id')
      .single()
    setCreating(false)
    if (error || !spot) { toast.error(error?.message ?? 'Could not add spot'); return }
    setNewName(''); setNewAddr(''); setNewLat(''); setNewLng('')
    onAdded(spot.id)
  }

  return (
    <div className="border-t-2 border-night-900/10 pt-4 space-y-3">
      <div className="flex gap-1 p-1 bg-warmgray-100 rounded-xl">
        <button
          onClick={() => setMode('existing')}
          className={`flex-1 px-3 py-1.5 text-xs font-extrabold uppercase tracking-crowd rounded-lg transition-colors ${
            mode === 'existing' ? 'bg-cream-50 shadow-sticker-sm text-night-900' : 'text-charcoal-400'
          }`}
        >
          Existing spot
        </button>
        <button
          onClick={() => setMode('new')}
          className={`flex-1 px-3 py-1.5 text-xs font-extrabold uppercase tracking-crowd rounded-lg transition-colors ${
            mode === 'new' ? 'bg-cream-50 shadow-sticker-sm text-night-900' : 'text-charcoal-400'
          }`}
        >
          + New spot
        </button>
      </div>

      {mode === 'existing' ? (
        <>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="input"
          />
          {search.trim().length >= 2 && (
            <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-night-900/10 bg-cream-50 divide-y divide-night-900/10">
              {searching ? (
                <p className="text-xs text-charcoal-400 p-3">Searching…</p>
              ) : existingResults.length === 0 ? (
                <p className="text-xs text-charcoal-400 italic p-3">
                  Nothing matches. Try the <button onClick={() => setMode('new')} className="text-sauce-500 hover:underline">+ New spot</button> tab.
                </p>
              ) : existingResults.map(s => {
                const already = existingSpotIds.has(s.id)
                return (
                  <button
                    key={s.id}
                    disabled={already}
                    onClick={() => { onAdded(s.id); setSearch(''); setExistingResults([]) }}
                    className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-cream-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-night-900 truncate">{s.name}</p>
                      <p className="text-xs text-charcoal-500 truncate">{s.address}</p>
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-crowd text-sauce-500 shrink-0">
                      {already ? 'Added' : '+ Add'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          <div>
            <label className="label">Name</label>
            <BusinessAutocomplete
              value={newName}
              onChange={setNewName}
              onSelect={(s) => { setNewName(s.name); setNewAddr(s.address); setNewLat(s.lat); setNewLng(s.lng) }}
              placeholder="Start typing — autocomplete pulls address + coords"
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input type="text" value={newAddr} onChange={e => setNewAddr(e.target.value)} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Latitude</label>
              <input type="text" value={newLat} onChange={e => setNewLat(e.target.value)} className="input" inputMode="decimal" />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input type="text" value={newLng} onChange={e => setNewLng(e.target.value)} className="input" inputMode="decimal" />
            </div>
          </div>
          <button onClick={handleCreateAndAdd} disabled={creating} className="btn-primary w-full mt-1">
            {creating ? 'Adding…' : 'Add spot to list'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Item editor ─────────────────────────────────────────────────────────────

function ItemEditor({
  item, rank, canMoveUp, canMoveDown, onMoveUp, onMoveDown, onRemove, onSaveNote,
}: {
  item: ItemWithSpot
  rank: number | null
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onSaveNote: (note: string) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(item.note ?? '')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const { spot } = item

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-2xl bg-cream-50 border-2 border-night-900/10 overflow-hidden"
    >
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
          className="w-10 h-10 rounded-lg flex items-center justify-center text-charcoal-300 hover:text-charcoal-600 hover:bg-warmgray-200 cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor">
            <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>

        {rank != null && (
          <div className="w-7 h-7 rounded-full bg-sauce-400 text-cream-50 text-xs font-bold flex items-center justify-center flex-shrink-0 border-2 border-night-900">
            {rank}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-charcoal-700 truncate">{spot?.name ?? 'Unknown spot'}</p>
          {spot?.address && <p className="text-xs text-charcoal-400 truncate">{spot.address}</p>}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="w-10 h-10 rounded-lg hover:bg-warmgray-200 disabled:opacity-30 flex items-center justify-center text-charcoal-500"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="w-10 h-10 rounded-lg hover:bg-warmgray-200 disabled:opacity-30 flex items-center justify-center text-charcoal-500"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            className="w-10 h-10 rounded-lg hover:bg-red-100 text-red-500 flex items-center justify-center text-lg"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      </div>

      <div className="border-t border-warmgray-200 px-3 pb-3 pt-2">
        {editingNote ? (
          <div className="space-y-2">
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={2}
              maxLength={280}
              placeholder="Why this spot? (max 280 chars)"
              className="input resize-none text-sm"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setNoteText(item.note ?? ''); setEditingNote(false) }}
                className="btn-ghost text-xs text-charcoal-500"
              >
                Cancel
              </button>
              <button
                onClick={() => { onSaveNote(noteText); setEditingNote(false) }}
                className="btn-primary text-xs py-1.5 px-3"
              >
                Save note
              </button>
            </div>
          </div>
        ) : item.note ? (
          <button onClick={() => setEditingNote(true)} className="w-full text-left text-sm text-charcoal-700 italic hover:text-night-900 transition-colors">
            "{item.note}"
            <span className="ml-2 text-[10px] uppercase tracking-crowd not-italic text-charcoal-300">Edit</span>
          </button>
        ) : (
          <button
            onClick={() => setEditingNote(true)}
            className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-sauce-500 transition-colors"
          >
            + Add a note
          </button>
        )}
      </div>
    </li>
  )
}
