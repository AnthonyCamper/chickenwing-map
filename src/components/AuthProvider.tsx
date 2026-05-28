import { createContext, useContext, type ReactNode } from 'react'
import type { AuthState } from '../hooks/useAuth'

const AuthContext = createContext<AuthState | null>(null)

/**
 * Read the app-wide auth state. Returns null if the consumer is rendered
 * outside an AuthProvider (e.g. error boundary fallback). Components that
 * require auth should check for null and degrade gracefully.
 */
export function useAuthContext(): AuthState | null {
  return useContext(AuthContext)
}

interface Props {
  auth: AuthState
  children: ReactNode
}

export function AuthProvider({ auth, children }: Props) {
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
