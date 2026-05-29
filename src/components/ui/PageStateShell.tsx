import { ReactNode } from 'react'
import AppHeader from '../AppHeader'

interface Props {
  children: ReactNode
}

/**
 * Wrapper for full-screen page states (loading / 404 / error / private)
 * so they still carry brand context (AppHeader) instead of dropping the
 * user into a blank cream screen with just a back link.
 */
export default function PageStateShell({ children }: Props) {
  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      <AppHeader />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center gap-4">
        {children}
      </div>
    </div>
  )
}
