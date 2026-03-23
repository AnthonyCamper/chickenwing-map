import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { UserProfile, SiteSettings } from '../lib/types'

interface UseAdminUsersReturn {
  users: UserProfile[]
  loading: boolean
  approveUser: (userId: string) => Promise<void>
  rejectUser: (userId: string) => Promise<void>
  disableUser: (userId: string) => Promise<void>
  enableUser: (userId: string) => Promise<void>
  setAdmin: (userId: string, isAdmin: boolean) => Promise<void>
  setCanReview: (userId: string, canLeaveReviews: boolean) => Promise<void>
  siteSettings: SiteSettings | null
  setSitePublic: (isPublic: boolean) => Promise<void>
  refresh: () => Promise<void>
}

export function useAdminUsers(): UseAdminUsersReturn {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [usersResult, settingsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, display_name, avatar_url, status, is_admin, can_leave_reviews, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('site_settings')
          .select('is_public')
          .eq('id', true)
          .maybeSingle(),
      ])

      if (usersResult.data) {
        setUsers(usersResult.data as UserProfile[])
      }
      if (settingsResult.data) {
        setSiteSettings({ is_public: settingsResult.data.is_public })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const updateUserStatus = async (userId: string, updates: Partial<UserProfile>) => {
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, email, full_name, display_name, avatar_url, status, is_admin, can_leave_reviews, created_at')
      .maybeSingle()

    if (data) {
      setUsers(prev => prev.map(u => (u.id === userId ? (data as UserProfile) : u)))
    }
  }

  const approveUser = (userId: string) => updateUserStatus(userId, { status: 'approved' })
  const rejectUser = (userId: string) => updateUserStatus(userId, { status: 'rejected' })
  const disableUser = (userId: string) => updateUserStatus(userId, { status: 'disabled' })
  const enableUser = (userId: string) => updateUserStatus(userId, { status: 'approved' })
  const setAdmin = (userId: string, isAdmin: boolean) => updateUserStatus(userId, { is_admin: isAdmin })
  const setCanReview = (userId: string, canLeaveReviews: boolean) =>
    updateUserStatus(userId, { can_leave_reviews: canLeaveReviews })

  const setSitePublic = async (isPublic: boolean) => {
    await supabase
      .from('site_settings')
      .update({ is_public: isPublic, updated_at: new Date().toISOString() })
      .eq('id', true)
    setSiteSettings({ is_public: isPublic })
  }

  return {
    users,
    loading,
    approveUser,
    rejectUser,
    disableUser,
    enableUser,
    setAdmin,
    setCanReview,
    siteSettings,
    setSitePublic,
    refresh: fetchAll,
  }
}
