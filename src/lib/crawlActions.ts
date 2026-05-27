import { supabase } from './supabase'
import type { CrawlFormData, WingCrawl } from './types'

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
): Promise<{ error: string | null }> {
  let position = options.position
  if (position == null) {
    const { data: existing } = await supabase
      .from('wing_crawl_items')
      .select('position')
      .eq('crawl_id', crawlId)
      .order('position', { ascending: false })
      .limit(1)
    position = existing?.[0]?.position != null ? existing[0].position + 1 : 0
  }

  const { error } = await supabase.from('wing_crawl_items').insert({
    crawl_id: crawlId,
    wing_spot_id: wingSpotId,
    position,
    note: options.note ?? null,
  })
  return { error: error?.message ?? null }
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

/** Persist a reordering: caller passes the item IDs in their new visual order. */
export async function reorderCrawlItems(
  itemIds: string[]
): Promise<{ error: string | null }> {
  for (let i = 0; i < itemIds.length; i++) {
    const { error } = await supabase
      .from('wing_crawl_items')
      .update({ position: i })
      .eq('id', itemIds[i])
    if (error) return { error: error.message }
  }
  return { error: null }
}
