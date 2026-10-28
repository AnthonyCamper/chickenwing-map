/**
 * Telling "you were signed out" apart from other publish failures.
 *
 * Publishing after the session ended (signed out in another tab, or an
 * expired token that couldn't refresh) comes back from PostgREST as a 401 /
 * "JWT expired" / an RLS refusal. That used to be reported as "Check your
 * connection", which a retry can never fix (m1 breaker 3).
 */

/** Returned as `error` by createReview when the session is gone. */
export const SIGNED_OUT_ERROR = 'signed-out'

const SIGNED_OUT_PATTERN =
  /jwt|not authenticated|must be signed in|signed out|auth session missing|invalid claim|pgrst30[123]|\b401\b|unauthori[sz]ed/i

export function looksSignedOut(message: string | null | undefined): boolean {
  if (!message) return false
  return message === SIGNED_OUT_ERROR || SIGNED_OUT_PATTERN.test(message)
}

export function signedOutMessage(hasPhotos: boolean): string {
  return hasPhotos
    ? "You've been signed out. Sign in again to publish — your review is saved, but you'll need to add your photos again."
    : "You've been signed out. Sign in again to publish — your review is saved."
}
