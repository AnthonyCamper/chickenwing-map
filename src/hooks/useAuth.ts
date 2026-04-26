import { useEffect, useState, useCallback } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
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
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<void>
  refreshProfile: () => Promise<void>
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [isAdmin, setIsAdmin] = useState(false)
  const [canLeaveReviews, setCanLeaveReviews] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

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
    const { data, error } = await supabase
      .from('profiles')
      .select('status, is_admin, can_leave_reviews, display_name, full_name, avatar_url, email, created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !data) {
      // Profile not yet created (e.g. trigger hasn't run) — treat as pending
      setStatus('pending')
      setIsAdmin(false)
      setCanLeaveReviews(false)
      setProfile(null)
      return
    }

    const p: UserProfile = {
      id: user.id,
      email: data.email ?? user.email ?? '',
      full_name: data.full_name,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      status: data.status,
      is_admin: data.is_admin,
      can_leave_reviews: data.can_leave_reviews,
      created_at: data.created_at,
    }
    setProfile(p)

    if (data.status === 'approved') {
      setStatus('authorized')
      setIsAdmin(data.is_admin ?? false)
      setCanLeaveReviews(data.can_leave_reviews ?? true)
    } else if (data.status === 'pending') {
      setStatus('pending')
      setIsAdmin(false)
      setCanLeaveReviews(false)
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
        const ext = avatar.name.split('.').pop() ?? 'jpg'
        const path = `${data.user.id}/avatar.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('user-avatars')
          .upload(path, avatar, { upsert: true })

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

    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    const userId = session?.user?.id
    if (!userId) return

    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('status, is_admin, can_leave_reviews, display_name, full_name, avatar_url, email, created_at')
      .maybeSingle()

    if (data) {
      setProfile(prev => prev ? { ...prev, ...updates } : prev)
    }
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
