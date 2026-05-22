import { createContext, useContext, useState } from 'react'
import UserProfileModal from './UserProfileModal'

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

export function UserProfileProvider({ currentUserId, children }: ProviderProps) {
  const [viewingId, setViewingId] = useState<string | null>(null)

  return (
    <UserProfileContext.Provider value={{ openProfile: setViewingId }}>
      {children}
      {viewingId && (
        <UserProfileModal
          userId={viewingId}
          currentUserId={currentUserId}
          onClose={() => setViewingId(null)}
        />
      )}
    </UserProfileContext.Provider>
  )
}
