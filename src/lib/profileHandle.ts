// Usernames ("handles") are the /u/<username> part of a profile link.
// The database makes the first one from the display name at sign-up
// (set_profile_username, using slugify() from migration 041); migration 042
// lets people change it and checks the rules below on the server too.

export const PROFILE_LINK_PREFIX = 'wingkingtony.com/u/'
export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

// Same letters, same order as slugify() in 041_slugify_transliterate_accents.sql.
const ACCENTS_FROM = 'áàâäãåāăąçćčďéèêëēėęěíìîïīįłñńňóòôöõøōőŕřśšşťúùûüūůűųýÿźżž'
const ACCENTS_TO = 'aaaaaaaaacccdeeeeeeeeiiiiiilnnnoooooooorrssstuuuuuuuuyyzzz'
const ACCENT_MAP = new Map(Array.from(ACCENTS_FROM).map((c, i) => [c, ACCENTS_TO[i]]))

/** Client copy of the database's slugify(): what a display name turns into. */
export function slugifyName(input: string): string {
  const lowered = (input ?? '').toLowerCase()
    .replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe')
  const plain = Array.from(lowered).map(c => ACCENT_MAP.get(c) ?? c).join('')
  return plain.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
}

/** The username sign-up will create: the slug, or slug-2, slug-3… when taken. */
export function firstFreeHandle(base: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  let candidate = base
  let n = 1
  while (used.has(candidate)) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

// Kept in step with the list in 042_username_change.sql.
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'help', 'staff',
  'mod', 'moderator', 'official', 'team', 'wingkingtony', 'wingking',
  'winkingtony', 'me', 'new', 'edit', 'settings', 'login', 'register',
  'null', 'undefined', 'anonymous', 'deleted', 'private', 'unknown',
])

/** Plain-English reason a new username can't be used, or null when it can. */
export function usernameProblem(name: string): string | null {
  if (!name) return 'Enter a username.'
  if (/[A-Z]/.test(name)) return 'Use small letters only (a–z).'
  if (/\s/.test(name)) return 'No spaces. Use a hyphen (-) between words.'
  if (!/^[a-z0-9-]+$/.test(name)) return 'Use only letters a–z, numbers 0–9 and hyphens (-).'
  if (name.startsWith('-') || name.endsWith('-')) return 'A username can’t start or end with a hyphen.'
  if (name.includes('--')) return 'Use only one hyphen in a row.'
  if (name.length < USERNAME_MIN) return `A username needs at least ${USERNAME_MIN} characters.`
  if (name.length > USERNAME_MAX) return `A username can have at most ${USERNAME_MAX} characters.`
  if (RESERVED_USERNAMES.has(name)) return 'That username is reserved. Choose another one.'
  return null
}

export const USERNAME_TAKEN_MESSAGE = 'Someone already uses that username. Choose another one.'

/** Turns the database's answer to a username change into plain English. */
export function usernameSaveError(error: { code?: string | null; message?: string | null }): string {
  const msg = (error.message ?? '').toLowerCase()
  if (error.code === '23505' || msg.includes('username: taken')) return USERNAME_TAKEN_MESSAGE
  if (msg.includes('username: reserved')) return 'That username is reserved. Choose another one.'
  if (msg.includes('username: must be')) return `A username needs ${USERNAME_MIN} to ${USERNAME_MAX} characters.`
  if (msg.includes('username: too many changes')) return 'You can change your username up to 3 times in 30 days. Try again later.'
  if (msg.includes('username: only')) return 'Use only letters a–z, numbers 0–9 and single hyphens (-).'
  return 'Your username could not be saved. Check your connection and try again.'
}
