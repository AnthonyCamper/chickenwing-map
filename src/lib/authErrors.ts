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

/** Auth failures that need a next step (a link), not just a sentence. */
export type AuthErrorKind = 'already-registered' | 'wrong-credentials' | null

export function authErrorKind(message: string | null | undefined): AuthErrorKind {
  const m = (message ?? '').toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user_already_exists')
    || m.includes('an account with this email already exists')) {
    return 'already-registered'
  }
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')
    || m.includes('email or password is wrong')) {
    return 'wrong-credentials'
  }
  return null
}

export const ALREADY_REGISTERED_MESSAGE =
  'An account with this email already exists. Sign in instead, or reset your password.'
export const WRONG_CREDENTIALS_MESSAGE =
  'Email or password is wrong. Try again or reset your password.'

/** Every auth error shown to a person goes through here: Supabase's own
 *  strings ("User already registered", "Invalid login credentials") read
 *  like untranslated server output. Unknown errors get a plain sentence with
 *  the original kept at the end for support. */
export function friendlyAuthError(message: string | null | undefined): string {
  if (!message) return 'Something went wrong. Please try again.'
  // Already ours (useAuth's authError can carry this one): show as written.
  if (message === SCHEMA_DRIFT_MESSAGE || message.startsWith('Something went wrong.')) return message

  const m = message.toLowerCase()

  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return "We couldn't send your confirmation email — too many have gone out in the last hour. Continue with Google instead (it's instant), or try again a bit later."
  }

  if (m.includes('is invalid') && m.includes('email')) {
    return "That email address doesn't look right — check it for typos and try again."
  }

  const kind = authErrorKind(message)
  if (kind === 'already-registered') return ALREADY_REGISTERED_MESSAGE
  if (kind === 'wrong-credentials') return WRONG_CREDENTIALS_MESSAGE

  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first. Open the link in the email we sent you, then sign in.'
  }
  if (m.includes('should be different from the old password') || m.includes('same_password')) {
    return 'Your new password must be different from your old password.'
  }
  if (m.includes('password should') || m.includes('weak_password') || m.includes('weak password')) {
    return 'That password is too easy to guess. Use at least 8 characters with a mix of letters and numbers.'
  }
  if (m.includes('signup') && (m.includes('disabled') || m.includes('not allowed'))) {
    return 'New accounts can’t be created right now. Please try again later.'
  }
  if (m.includes('only request this after') || m.includes('request rate limit') || m.includes('over_request_rate_limit')
    || m.includes('too many requests')) {
    return 'Too many tries in a short time. Wait a minute, then try again.'
  }
  if (m.includes('expired') || m.includes('auth session missing') || m.includes('invalid jwt')) {
    return 'Your sign-in link has expired. Ask for a new link and try again.'
  }
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || m.includes('network request failed')) {
    return 'We couldn’t reach the server. Check your internet connection and try again.'
  }

  return `Something went wrong. Please try again. (Details: ${message})`
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
  if (password && !password.trim()) return 'Your password can’t be only spaces.'
  if (password.length >= MIN_PASSWORD_LENGTH) return null
  const left = MIN_PASSWORD_LENGTH - password.length
  return `Password needs at least ${MIN_PASSWORD_LENGTH} characters (${left} more).`
}

// Invisible bidi controls (e.g. U+202E) flip how a name renders and can be
// used to spoof another member's name.
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/

export function displayNameProblem(name: string): string | null {
  if (!name.trim()) return 'Enter a display name. It can’t be only spaces.'
  if (BIDI_CONTROLS.test(name)) return 'Your name has hidden text-direction characters. Please type it again.'
  return null
}

/** First thing stopping the sign-up form from being sent, in field order, or
 *  null when it's ready. Shown next to the disabled button so it's never a
 *  mystery why it won't submit. */
export function signUpProblem(f: { displayName: string; email: string; password: string }): string | null {
  if (!f.displayName.trim()) return 'Enter a display name.'
  const nameProblem = displayNameProblem(f.displayName)
  if (nameProblem) return nameProblem
  if (!f.email.trim()) return 'Enter your email address.'
  if (!isValidEmail(f.email)) return EMAIL_FORMAT_MESSAGE
  if (!f.password) return 'Choose a password.'
  return passwordProblem(f.password)
}
