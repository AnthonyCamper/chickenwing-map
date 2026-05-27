import { createContext, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface UserProfileContextValue {
  openProfile: (userId: string) => void
}

const UserProfileContext = createContext<UserProfileContextValue>({ openProfile: () => {} })

export function useUserProfile() {
  return useContext(UserProfileContext)
}

interface ProviderProps {
  currentUserId: string
  children: React.ReactNode
}

export function UserProfileProvider({ children }: ProviderProps) {
  const navigate = useNavigate()

  const openProfile = useCallback((userId: string) => {
    if (!userId) return
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle()
      if (data?.username) {
        navigate(`/u/${data.username}`)
      }
    })()
  }, [navigate])

  return (
    <UserProfileContext.Provider value={{ openProfile }}>
      {children}
    </UserProfileContext.Provider>
  )
}
