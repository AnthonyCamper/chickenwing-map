import { supabase } from './supabase'
import { compressImage } from './reviewActions'
import type { CrawlFormData, WingCrawl, WingCrawlItem } from './types'

export async function createCrawl(
  data: CrawlFormData,
  userId: string
): Promise<{ error: string | null; crawl?: WingCrawl }> {
  const { data: row, error } = await supabase
    .from('wing_crawls')
    .insert({
      user_id: userId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      is_public: data.is_public ?? true,
      is_ranked: data.is_ranked ?? false,
      cover_image_url: data.cover_image_url ?? null,
    })
    .select('*')
    .single()

  if (error || !row) return { error: error?.message ?? 'Could not create crawl' }
  return { error: null, crawl: row as WingCrawl }
}

export async function updateCrawl(
  crawlId: string,
  data: Partial<CrawlFormData>
): Promise<{ error: string | null }> {
  const updates: Record<string, unknown> = {}
  if (data.title !== undefined) updates.title = data.title.trim()
  if (data.description !== undefined) updates.description = data.description?.trim() || null
  if (data.is_public !== undefined) updates.is_public = data.is_public
  if (data.is_ranked !== undefined) updates.is_ranked = data.is_ranked
  if (data.cover_image_url !== undefined) updates.cover_image_url = data.cover_image_url ?? null

  if (Object.keys(updates).length === 0) return { error: null }

  const { error } = await supabase.from('wing_crawls').update(updates).eq('id', crawlId)
  return { error: error?.message ?? null }
}

export async function deleteCrawl(crawlId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('wing_crawls').delete().eq('id', crawlId)
  return { error: error?.message ?? null }
}

export async function addCrawlItem(
  crawlId: string,
  wingSpotId: string,
  options: { note?: string | null; position?: number } = {}
): Promise<{ error: string | null; item?: WingCrawlItem }> {
  // Position is assigned by the set_crawl_item_position() trigger when we
  // pass 0 (the default), avoiding the read-max-then-insert race.
  const insertRow: Record<string, unknown> = {
    crawl_id: crawlId,
    wing_spot_id: wingSpotId,
    note: options.note ?? null,
  }
  if (options.position != null) insertRow.position = options.position

  const { data, error } = await supabase
    .from('wing_crawl_items')
    .insert(insertRow)
    .select('*')
    .single()
  if (error || !data) return { error: error?.message ?? 'Could not add item' }
  return { error: null, item: data as WingCrawlItem }
}

export async function removeCrawlItem(itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('wing_crawl_items').delete().eq('id', itemId)
  return { error: error?.message ?? null }
}

export async function updateCrawlItemNote(
  itemId: string,
  note: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('wing_crawl_items')
    .update({ note: note?.trim() || null })
    .eq('id', itemId)
  return { error: error?.message ?? null }
}

export async function uploadCrawlCover(
  crawlId: string,
  userId: string,
  file: File
): Promise<{ error: string | null; url?: string }> {
  try {
    const compressed = await compressImage(file)
    // Stable filename + upsert=true so re-uploads replace the prior cover
    // in place instead of orphaning it in storage.
    const path = `${userId}/${crawlId}/cover.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('crawl-covers')
      .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
    if (uploadErr) return { error: uploadErr.message }

    const { data: { publicUrl } } = supabase.storage
      .from('crawl-covers')
      .getPublicUrl(path)

    // Cache-bust query so the CDN serves the new bytes.
    const bustedUrl = `${publicUrl}?v=${Date.now()}`

    const { error: updateErr } = await supabase
      .from('wing_crawls')
      .update({ cover_image_url: bustedUrl })
      .eq('id', crawlId)
    if (updateErr) return { error: updateErr.message }

    return { error: null, url: bustedUrl }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload failed' }
  }
}

export async function deleteCrawlCover(
  crawlId: string,
  userId: string
): Promise<{ error: string | null }> {
  // Best-effort storage cleanup. Failure here is non-fatal — the DB row
  // is the source of truth for what the page shows.
  await supabase.storage
    .from('crawl-covers')
    .remove([`${userId}/${crawlId}/cover.jpg`])

  const { error } = await supabase
    .from('wing_crawls')
    .update({ cover_image_url: null })
    .eq('id', crawlId)
  return { error: error?.message ?? null }
}

export async function toggleCrawlLike(
  crawlId: string,
  userId: string,
  isCurrentlyLiked: boolean
): Promise<{ error: string | null }> {
  if (isCurrentlyLiked) {
    const { error } = await supabase
      .from('crawl_likes')
      .delete()
      .match({ crawl_id: crawlId, user_id: userId })
    return { error: error?.message ?? null }
  } else {
    const { error } = await supabase
      .from('crawl_likes')
      .insert({ crawl_id: crawlId, user_id: userId })
    return { error: error?.message ?? null }
  }
}

/** Persist a reordering atomically via the reorder_crawl_items RPC. */
export async function reorderCrawlItems(
  itemIds: string[]
): Promise<{ error: string | null }> {
  if (itemIds.length === 0) return { error: null }
  const { error } = await supabase.rpc('reorder_crawl_items', { p_ids: itemIds })
  return { error: error?.message ?? null }
}
