import { useEffect, useState, useCallback, useRef } from 'react'
import { Session, User } from '@supabase/supabase-js'
import toast from 'react-hot-toast'
import { AUTH_STORAGE_KEY, supabase } from '../lib/supabase'
import { friendlyAuthError, isSchemaDriftError, SCHEMA_DRIFT_MESSAGE } from '../lib/authErrors'
import { clearReturnTo } from '../lib/authReturn'
import { AVATAR_MAX_SIDE, downscaleImage, imageExtension } from '../lib/imageResize'
import type { AuthStatus, UserProfile, SiteSettings } from '../lib/types'

export interface AuthState {
  session: Session | null
  user: User | null
  status: AuthStatus
  isAdmin: boolean
  canLeaveReviews: boolean
  profile: UserProfile | null
  siteSettings: SiteSettings | null
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    avatar?: File
  ) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>
  signOut: () => Promise<void>
  /** Resolves true when the row was saved; on failure it has already shown a toast. */
  updateProfile: (updates: { display_name?: string; avatar_url?: string; is_private?: boolean; bio?: string; username?: string }) => Promise<boolean>
  refreshProfile: () => Promise<void>
}

// Shared by every useAuth() caller: one sign-out at a time.
let signOutInFlight: Promise<void> | null = null

/**
 * Sign out, single-flight: a double tap (or the menu and a status screen both
 * asking) shares the one in-flight /auth/v1/logout instead of firing a second
 * request (S25). Resolves only after the server has answered (supabase-js
 * revokes the session there first, then clears it locally), so callers can
 * navigate afterwards. If the request fails (offline), the session is kept —
 * say so instead of silently leaving the user signed in.
 */
export function signOutOnce(): Promise<void> {
  if (!signOutInFlight) {
    signOutInFlight = (async () => {
      try {
        const { error } = await supabase.auth.signOut()
        if (error) toast.error("Couldn't sign you out. Check your internet connection and try again.")
      } finally {
        signOutInFlight = null
      }
    })()
  }
  return signOutInFlight
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isAdmin, setIsAdmin] = useState(false)
  const [canLeaveReviews, setCanLeaveReviews] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  // checkApproval reruns on every auth state change; only shout once.
  const schemaDriftReported = useRef(false)

  // Detect OAuth callback errors in URL and clean them up
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'))
    const errorDesc = params.get('error_description') || hashParams.get('error_description')

    if (errorDesc) {
      setAuthError(errorDesc)
      // Clean error params from URL without reload
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  // Load site settings once (readable by anon)
  useEffect(() => {
    supabase
      .from('site_settings')
      .select('is_public')
      .eq('id', true)
      .maybeSingle()
      .then(({ data }) => {
        setSiteSettings(data ? { is_public: data.is_public } : { is_public: false })
      })
  }, [])

  const checkApproval = useCallback(async (user: User) => {
    const [{ data, error }, { data: settingsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('status, is_admin, can_leave_reviews, display_name, full_name, username, avatar_url, bio, is_private, created_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('site_settings')
        .select('is_public')
        .eq('id', true)
        .maybeSingle(),
    ])

    const isPublic = settingsData?.is_public ?? false
    if (settingsData) setSiteSettings({ is_public: settingsData.is_public })

    if (error) {
      // Schema drift is permanent: waiting or retrying will not fix it, and
      // quietly degrading to read-only hides a broken deploy from everyone —
      // it once cost two weeks of nobody being able to post. Say so instead.
      if (isSchemaDriftError(error)) {
        console.error('[auth] profile fetch rejected by the database:', error)
        setAuthError(SCHEMA_DRIFT_MESSAGE)
        if (!schemaDriftReported.current) {
          schemaDriftReported.current = true
          toast.error(SCHEMA_DRIFT_MESSAGE, { duration: 10000 })
        }
      }

      // Transient fetch failure (network, RLS hiccup) — keep whatever
      // status/profile we already resolved rather than demoting an approved
      // user to the pending gate mid-session. Only a cold load (still
      // 'loading') falls back to the old default gates.
      setStatus(prev =>
        prev === 'loading' ? (isPublic ? 'authorized' : 'pending') : prev
      )
      return
    }

    if (!data) {
      // Profile genuinely not yet created — in public mode let them in read-only, otherwise pending gate
      if (isPublic) {
        setStatus('authorized')
        setIsAdmin(false)
        setCanLeaveReviews(false)
      } else {
        setStatus('pending')
        setIsAdmin(false)
        setCanLeaveReviews(false)
      }
      setProfile(null)
      return
    }

    const p: UserProfile = {
      id: user.id,
      email: user.email ?? '',
      full_name: data.full_name,
      display_name: data.display_name,
      username: data.username ?? null,
      avatar_url: data.avatar_url,
      bio: data.bio ?? null,
      status: data.status,
      is_admin: data.is_admin,
      can_leave_reviews: data.can_leave_reviews,
      is_private: data.is_private ?? false,
      created_at: data.created_at,
    }
    setProfile(p)

    if (data.status === 'approved') {
      setStatus('authorized')
      setIsAdmin(data.is_admin ?? false)
      setCanLeaveReviews(data.can_leave_reviews ?? true)
    } else if (data.status === 'pending') {
      if (isPublic) {
        // In public mode, skip the approval gate entirely
        setStatus('authorized')
        setIsAdmin(false)
        setCanLeaveReviews(true)
      } else {
        setStatus('pending')
        setIsAdmin(false)
        setCanLeaveReviews(false)
      }
    } else if (data.status === 'rejected') {
      setStatus('rejected')
      setIsAdmin(false)
      setCanLeaveReviews(false)
    } else if (data.status === 'disabled') {
      setStatus('disabled')
      setIsAdmin(false)
      setCanLeaveReviews(false)
    } else {
      setStatus('pending')
      setIsAdmin(false)
      setCanLeaveReviews(false)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await checkApproval(session.user)
    }
  }, [checkApproval])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        checkApproval(session.user)
      } else {
        setStatus('unauthenticated')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user) {
          checkApproval(session.user)
        } else {
          setStatus('unauthenticated')
          setIsAdmin(false)
          setCanLeaveReviews(false)
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [checkApproval])

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signInWithEmail = async (
    email: string,
    password: string
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName: string,
    avatar?: File
  ): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: displayName },
        emailRedirectTo: window.location.origin,
      },
    })

    if (error) return { error: error.message }

    // Upload avatar if provided and we have a user ID
    if (avatar && data.user) {
      try {
        const upload = await downscaleImage(avatar, { maxSide: AVATAR_MAX_SIDE })
        const path = `${data.user.id}/avatar.${imageExtension(upload)}`
        const { error: uploadError } = await supabase.storage
          .from('user-avatars')
          .upload(path, upload, { upsert: true, contentType: upload.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('user-avatars')
            .getPublicUrl(path)

          // Store avatar URL and display_name in profile (trigger already created the row)
          await supabase
            .from('profiles')
            .update({ avatar_url: urlData.publicUrl, display_name: displayName })
            .eq('id', data.user.id)
        }
      } catch {
        // Avatar upload failure is non-fatal
      }
    } else if (data.user && displayName) {
      // Save display_name even without avatar
      await supabase
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', data.user.id)
    }

    // If no session was returned, email confirmation is required
    if (!data.session) {
      return { error: null, needsEmailConfirmation: true }
    }

    // The SIGNED_IN listener already read the profile, usually before the
    // avatar and name above were saved, so the header showed the initial
    // until a reload. Read it again now that they are.
    if (data.user) await checkApproval(data.user)

    return { error: null }
  }

  // See signOutOnce: resolves after the server answered; one request at a time.
  const signOut = signOutOnce

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string; is_private?: boolean; bio?: string; username?: string }): Promise<boolean> => {
    const userId = session?.user?.id
    if (!userId) return false

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('status, is_admin, can_leave_reviews, display_name, full_name, username, avatar_url, bio, is_private, created_at')
      .maybeSingle()

    if (error || !data) {
      // Never show raw backend text (e.g. a Postgres constraint message)
      if (error) console.error('[auth] profile update failed:', error)
      toast.error('Your profile could not be saved. Check your connection and try again.')
      return false
    }
    setProfile(prev => prev ? { ...prev, ...updates } : prev)
    return true
  }

  return {
    session,
    user: session?.user ?? null,
    status,
    isAdmin,
    canLeaveReviews,
    profile,
    siteSettings,
    authError,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    updateProfile,
    refreshProfile,
  }
}

// ── Account settings ─────────────────────────────────────────────────────────

/** True for accounts that can sign in with an email + password (as opposed to
 *  Google only), i.e. the ones where "Change password" means something. */
export function hasPasswordLogin(user: User | null | undefined): boolean {
  if (!user) return false
  const providers = user.app_metadata?.providers
  if (Array.isArray(providers)) return providers.includes('email')
  return user.app_metadata?.provider === 'email'
}

/**
 * Re-check the signed-in user's password before a sensitive action (change
 * password, delete account), so anyone at an unlocked, signed-in device can't
 * do it. Returns a user-facing error, or null when the password is right.
 */
export async function verifyCurrentPassword(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (!error) return null
  return error.message.toLowerCase().includes('invalid login')
    ? 'Your current password is not correct.'
    : friendlyAuthError(error.message)
}

/** Check the current password, then set a new one. */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ error: string | null }> {
  // updateUser alone doesn't ask for the old password, so re-check it first.
  const checkError = await verifyCurrentPassword(email, currentPassword)
  if (checkError) return { error: checkError }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: friendlyAuthError(error.message) }
  return { error: null }
}

// Every file this user uploaded lives under "<uid>/…" (avatars: <uid>/avatar.ext;
// review photos and list covers: <uid>/<review or list id>/<file>). Storage
// list() isn't recursive, so walk one level of sub-folders.
const USER_BUCKETS = ['review-photos', 'user-avatars', 'crawl-covers'] as const

async function removeUserFolder(bucket: string, userId: string): Promise<void> {
  const store = supabase.storage.from(bucket)
  const { data: top } = await store.list(userId, { limit: 1000 })
  const paths: string[] = []
  for (const item of top ?? []) {
    if (item.id) {
      paths.push(`${userId}/${item.name}`)
      continue
    }
    // id === null → a folder
    const { data: inner } = await store.list(`${userId}/${item.name}`, { limit: 1000 })
    for (const f of inner ?? []) {
      if (f.id) paths.push(`${userId}/${item.name}/${f.name}`)
    }
  }
  for (let i = 0; i < paths.length; i += 100) {
    await store.remove(paths.slice(i, i + 100))
  }
}

/**
 * Permanently delete the signed-in user's account. Uploaded files are removed
 * first (best effort: a failure there must not block deleting the account),
 * then the delete_own_account() RPC (migration 038) deletes the auth user and
 * the database cascades remove their profile and everything they posted.
 * Finally drops the local session; the caller reloads the page.
 */
export async function deleteOwnAccount(userId: string): Promise<{ error: string | null }> {
  for (const bucket of USER_BUCKETS) {
    try { await removeUserFolder(bucket, userId) } catch { /* best effort */ }
  }
  const { error } = await supabase.rpc('delete_own_account')
  if (error) return { error: error.message || 'Could not delete your account. Please try again.' }
  clearReturnTo()
  // The user no longer exists server-side, so only clear the local session.
  // Not signOut(): even with scope 'local' it calls /auth/v1/logout, which
  // now answers 403 (user gone) and leaves an error in the browser console.
  try {
    await supabase.auth.stopAutoRefresh()
    localStorage.removeItem(AUTH_STORAGE_KEY)
    localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`)
  } catch { /* storage blocked: nothing to clear */ }
  return { error: null }
}
