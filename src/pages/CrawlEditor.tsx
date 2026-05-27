import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
} from '../lib/crawlActions'
import TopBar from '../components/ui/TopBar'
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
  const [crawl, setCrawl] = useState<WingCrawl | null>(null)
  const [items, setItems] = useState<ItemWithSpot[]>([])
  const [loading, setLoading] = useState(!isNew)

  // Meta-form state (local until Save)
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
      toast.error('Crawl not found')
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

  async function handleSaveMeta() {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSavingMeta(true)
    try {
      if (isNew) {
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id
        if (!userId) { toast.error('Not signed in'); return }
        const result = await createCrawl({
          title, description, is_public: isPublic, is_ranked: isRanked,
        }, userId)
        if (result.error || !result.crawl) {
          toast.error(result.error ?? 'Could not create')
          return
        }
        toast.success('Crawl created')
        navigate(`/crawls/${result.crawl.id}/edit`, { replace: true })
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
    if (!window.confirm('Delete this crawl? This cannot be undone.')) return
    const { error } = await deleteCrawl(crawl.id)
    if (error) { toast.error(error); return }
    toast.success('Deleted')
    navigate('/', { replace: true })
  }

  async function handleAddSpot(spot: WingSpot) {
    if (!crawl) return
    if (items.some(i => i.wing_spot_id === spot.id)) {
      toast('Already in this crawl', { icon: '👀' })
      return
    }
    const { error } = await addCrawlItem(crawl.id, spot.id)
    if (error) { toast.error(error); return }
    await load()
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

  async function handleMove(itemId: string, direction: -1 | 1) {
    const idx = items.findIndex(i => i.id === itemId)
    const newIdx = idx + direction
    if (idx < 0 || newIdx < 0 || newIdx >= items.length) return
    const next = [...items]
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    setItems(next)
    const { error } = await reorderCrawlItems(next.map(i => i.id))
    if (error) { toast.error(error); await load() }
  }

  if (!authChecked) {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </div>
    )
  }
  if (!authed) return null
  if (loading) {
    return (
      <div className="min-h-dvh bg-paper flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-cream-200 border-t-sauce-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper">
      <Helmet>
        <title>{isNew ? 'New crawl' : `Edit: ${crawl?.title ?? 'Crawl'}`} — WingKingTony</title>
      </Helmet>

      <TopBar />

      <header className="border-b-2 border-night-900 bg-cream-100">
        <div className="max-w-3xl mx-auto px-5 py-6">
          <p className="eyebrow mb-2">{isNew ? 'New crawl' : 'Editing'}</p>
          <h1 className="font-display uppercase text-3xl text-night-900 leading-none tracking-tightest">
            {isNew ? 'Start a new crawl' : crawl?.title ?? 'Crawl'}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-8">
        {/* Meta form */}
        <section className="bg-cream-50 border-2 border-night-900 rounded-xl p-5 shadow-sticker space-y-4">
          <div>
            <label className="eyebrow block mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Best hot wings in Brooklyn"
              maxLength={120}
              className="w-full px-3 py-2 border-2 border-night-900 rounded-lg bg-cream-50 text-night-900 placeholder-charcoal-300 focus:outline-none focus:border-sauce-400"
            />
          </div>

          <div>
            <label className="eyebrow block mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Why this list? What's the through-line?"
              rows={3}
              maxLength={600}
              className="w-full px-3 py-2 border-2 border-night-900 rounded-lg bg-cream-50 text-night-900 placeholder-charcoal-300 focus:outline-none focus:border-sauce-400 resize-none"
            />
          </div>

          <div className="flex flex-wrap gap-5 text-sm">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isRanked}
                onChange={e => setIsRanked(e.target.checked)}
                className="w-4 h-4 accent-sauce-400"
              />
              <span className="font-bold text-night-800">Ranked</span>
              <span className="text-xs text-charcoal-500">(numbered top → bottom)</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="w-4 h-4 accent-sauce-400"
              />
              <span className="font-bold text-night-800">Public</span>
              <span className="text-xs text-charcoal-500">(shareable link)</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveMeta}
              disabled={savingMeta || !title.trim()}
              className="btn-primary px-5 disabled:opacity-50"
            >
              {savingMeta ? 'Saving…' : isNew ? 'Create crawl' : 'Save'}
            </button>
            {!isNew && crawl && (
              <Link to={`/lists/${crawl.slug}`} className="btn-secondary px-4 text-xs">
                View public page
              </Link>
            )}
            {!isNew && (
              <button
                onClick={handleDeleteCrawl}
                className="ml-auto text-xs font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-sauce-600"
              >
                Delete crawl
              </button>
            )}
          </div>
        </section>

        {/* Items section — only after the crawl exists */}
        {!isNew && crawl && (
          <section className="space-y-4">
            <h2 className="eyebrow">Spots</h2>

            <SpotPicker existingSpotIds={items.map(i => i.wing_spot_id)} onPick={handleAddSpot} />

            {items.length === 0 ? (
              <p className="text-charcoal-500 text-sm italic">No spots yet — search above to add some.</p>
            ) : (
              <ol className="space-y-2">
                {items.map((item, idx) => (
                  <ItemEditor
                    key={item.id}
                    item={item}
                    rank={isRanked ? idx + 1 : null}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < items.length - 1}
                    showMove={isRanked}
                    onMoveUp={() => handleMove(item.id, -1)}
                    onMoveDown={() => handleMove(item.id, 1)}
                    onRemove={() => handleRemoveItem(item.id)}
                    onSaveNote={(note) => handleSaveNote(item.id, note)}
                  />
                ))}
              </ol>
            )}
          </section>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SpotPicker({ existingSpotIds, onPick }: {
  existingSpotIds: string[]
  onPick: (spot: WingSpot) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<WingSpot[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('wing_spots')
        .select('*')
        .ilike('name', `%${query.trim()}%`)
        .order('name')
        .limit(20)
      if (cancelled) return
      setResults((data ?? []) as WingSpot[])
      setSearching(false)
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  return (
    <div className="bg-cream-50 border-2 border-night-900 rounded-xl p-3 shadow-sticker">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search wing spots to add…"
        className="w-full px-3 py-2 border-2 border-night-900 rounded-lg bg-paper text-night-900 placeholder-charcoal-300 focus:outline-none focus:border-sauce-400 text-sm"
      />

      {query.trim().length >= 2 && (
        <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-night-900/10">
          {searching ? (
            <p className="text-xs text-charcoal-400 py-2">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-xs text-charcoal-400 py-2 italic">
              No matches. Add a review for a new spot first, then come back.
            </p>
          ) : results.map(s => {
            const already = existingSpotIds.includes(s.id)
            return (
              <button
                key={s.id}
                disabled={already}
                onClick={() => { onPick(s); setQuery(''); setResults([]) }}
                className="w-full text-left py-2 px-1 flex items-center justify-between gap-2 hover:bg-cream-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
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
    </div>
  )
}

function ItemEditor({
  item, rank, canMoveUp, canMoveDown, showMove, onMoveUp, onMoveDown, onRemove, onSaveNote,
}: {
  item: ItemWithSpot
  rank: number | null
  canMoveUp: boolean
  canMoveDown: boolean
  showMove: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onSaveNote: (note: string) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(item.note ?? '')

  const { spot } = item

  return (
    <li className="bg-cream-50 border-2 border-night-900 rounded-xl p-3 shadow-sticker">
      <div className="flex items-start gap-3">
        {rank != null && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-sauce-400 border-2 border-night-900 flex items-center justify-center font-display text-sm text-night-900">
            {rank}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-display uppercase text-base text-night-900 truncate">{spot?.name ?? 'Unknown spot'}</p>
          {spot?.address && <p className="text-xs text-charcoal-500 truncate">{spot.address}</p>}

          {editingNote ? (
            <div className="mt-2">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                maxLength={280}
                placeholder="Why this spot? (max 280 chars)"
                className="w-full px-2 py-1.5 text-sm border-2 border-night-900 rounded-lg bg-paper text-night-900 placeholder-charcoal-300 focus:outline-none focus:border-sauce-400 resize-none"
                autoFocus
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => { onSaveNote(noteText); setEditingNote(false) }}
                  className="text-xs font-extrabold uppercase tracking-crowd text-sauce-500 hover:text-sauce-600"
                >
                  Save note
                </button>
                <button
                  onClick={() => { setNoteText(item.note ?? ''); setEditingNote(false) }}
                  className="text-xs font-extrabold uppercase tracking-crowd text-charcoal-400 hover:text-charcoal-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : item.note ? (
            <p
              className="text-sm text-charcoal-700 mt-1.5 italic cursor-text"
              onClick={() => setEditingNote(true)}
            >
              "{item.note}"
            </p>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-xs font-bold uppercase tracking-crowd text-charcoal-400 hover:text-sauce-500 mt-1.5 transition-colors"
            >
              + Add a note
            </button>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          {showMove && (
            <>
              <button
                onClick={onMoveUp}
                disabled={!canMoveUp}
                aria-label="Move up"
                className="w-6 h-6 flex items-center justify-center text-charcoal-400 hover:text-night-900 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                ▲
              </button>
              <button
                onClick={onMoveDown}
                disabled={!canMoveDown}
                aria-label="Move down"
                className="w-6 h-6 flex items-center justify-center text-charcoal-400 hover:text-night-900 disabled:opacity-20 disabled:cursor-not-allowed"
              >
                ▼
              </button>
            </>
          )}
          <button
            onClick={onRemove}
            aria-label="Remove"
            className="w-6 h-6 flex items-center justify-center text-charcoal-300 hover:text-sauce-600 text-base"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  )
}
