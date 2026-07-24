/**
 * Badge rarity, computed from badge_earn_stats numbers carried on the badge
 * row (earned_count / member_count). Returns null when stats are missing so
 * consumers can simply skip the rarity line.
 */

export type RarityTier = 'first' | 'legendary' | 'rare' | 'uncommon' | 'common'

export interface BadgeRarity {
  tier: RarityTier
  /** Short chip text, e.g. "Legendary" */
  label: string
  /** 0–100, rounded to nearest whole percent (min 1 when anyone has it) */
  pct: number
  earnedCount: number
  memberCount: number
}

const LABELS: Record<RarityTier, string> = {
  first: 'One of a kind',
  legendary: 'Legendary',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
}

export function badgeRarity(
  earnedCount: number | null | undefined,
  memberCount: number | null | undefined,
): BadgeRarity | null {
  if (earnedCount == null || memberCount == null || memberCount <= 0) return null

  const ratio = Math.min(earnedCount / memberCount, 1)
  const pct = earnedCount === 0 ? 0 : Math.max(1, Math.round(ratio * 100))

  let tier: RarityTier
  if (earnedCount <= 1) tier = 'first'
  else if (ratio <= 0.10) tier = 'legendary'
  else if (ratio <= 0.25) tier = 'rare'
  else if (ratio <= 0.50) tier = 'uncommon'
  else tier = 'common'

  return { tier, label: LABELS[tier], pct, earnedCount, memberCount }
}

/** Tailwind classes for the rarity chip, per tier. */
export const RARITY_CHIP_CLASSES: Record<RarityTier, string> = {
  first:     'bg-gold-300 text-night-900 border-night-900',
  legendary: 'bg-gold-300 text-night-900 border-night-900',
  rare:      'bg-sauce-400 text-cream-50 border-night-900',
  uncommon:  'bg-night-800 text-cream-50 border-night-900',
  common:    'bg-cream-200 text-night-700 border-night-900/30',
}
