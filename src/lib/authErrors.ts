/**
 * Turns raw Supabase auth errors into something a visitor can act on.
 *
 * The big one is the email send cap: Supabase's transactional email is capped
 * per hour, and once it's hit every signup and password reset comes back as a
 * bare "email rate limit exceeded" — which reads like the user did something
 * wrong. Point them at Google sign-in instead, which sends no email.
 */
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
