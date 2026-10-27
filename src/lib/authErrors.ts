/**
 * Turns raw Supabase auth errors into something a visitor can act on.
 *
 * The big one is the email send cap: Supabase's transactional email is capped
 * per hour, and once it's hit every signup and password reset comes back as a
 * bare "email rate limit exceeded" — which reads like the user did something
 * wrong. Point them at Google sign-in instead, which sends no email.
 */
/**
 * Postgres/PostgREST codes that mean the client and the database have drifted
 * apart — a revoked grant, or a column the client still asks for that the
 * schema no longer exposes. Retrying never clears these; only a deploy does.
 */
const SCHEMA_DRIFT_CODES = new Set([
  '42501', // insufficient_privilege — grant revoked out from under the client
  '42703', // undefined_column
  '42P01', // undefined_table
  'PGRST202', // schema cache: function not found
  'PGRST204', // schema cache: column not found
])

export const SCHEMA_DRIFT_MESSAGE =
  "This app is out of date and the server rejected it, so you're seeing a read-only view. Reload the page; if that doesn't help, the site needs a redeploy."

export function isSchemaDriftError(error: { code?: string | null } | null | undefined): boolean {
  return !!error?.code && SCHEMA_DRIFT_CODES.has(error.code)
}

export function friendlyAuthError(message: string): string {
  if (!message) return 'Something went wrong. Please try again.'

  const m = message.toLowerCase()

  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return "We couldn't send your confirmation email — too many have gone out in the last hour. Continue with Google instead (it's instant), or try again a bit later."
  }

  if (m.includes('is invalid') && m.includes('email')) {
    return "That email address doesn't look right — check it for typos and try again."
  }

  return message
}

// ── Sign-up form checks ─────────────────────────────────────────────────────

export const MIN_PASSWORD_LENGTH = 8

/** Something@something.tld: the browser's type=email check accepts
 *  "name@example" (no dot in the domain), which can never receive mail. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim())
}

export const EMAIL_FORMAT_MESSAGE = 'Enter a full email address, for example name@gmail.com.'

export function passwordProblem(password: string): string | null {
  if (password.length >= MIN_PASSWORD_LENGTH) return null
  const left = MIN_PASSWORD_LENGTH - password.length
  return `Password needs at least ${MIN_PASSWORD_LENGTH} characters (${left} more).`
}

export function displayNameProblem(name: string): string | null {
  return name.trim() ? null : 'Enter a display name. It can’t be only spaces.'
}

/** First thing stopping the sign-up form from being sent, in field order, or
 *  null when it's ready. Shown next to the disabled button so it's never a
 *  mystery why it won't submit. */
export function signUpProblem(f: { displayName: string; email: string; password: string }): string | null {
  if (!f.displayName.trim()) return 'Enter a display name.'
  if (!f.email.trim()) return 'Enter your email address.'
  if (!isValidEmail(f.email)) return EMAIL_FORMAT_MESSAGE
  if (!f.password) return 'Choose a password.'
  return passwordProblem(f.password)
}
