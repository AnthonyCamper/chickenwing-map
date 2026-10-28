import { ComponentProps, ReactNode } from 'react'
import { Helmet } from 'react-helmet-async'
import AppHeader from '../AppHeader'

interface Props {
  children: ReactNode
  /** Browser tab title for this state, e.g. "Spot not found — WingKingTony". */
  title?: string
  /** Passed through to AppHeader (e.g. the home page's view tabs while the
   *  app is still loading, so the header doesn't change shape). */
  headerProps?: ComponentProps<typeof AppHeader>
}

/**
 * Wrapper for full-screen page states (loading / 404 / error / private)
 * so they still carry brand context (AppHeader) instead of dropping the
 * user into a blank cream screen with just a back link.
 */
export default function PageStateShell({ children, title, headerProps }: Props) {
  return (
    <div className="min-h-dvh bg-paper flex flex-col">
      {title && (
        <Helmet>
          <title>{title}</title>
        </Helmet>
      )}
      <AppHeader {...headerProps} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center gap-4">
        {children}
      </div>
    </div>
  )
}
