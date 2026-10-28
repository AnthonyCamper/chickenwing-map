import { Component, ErrorInfo, ReactNode } from 'react'
import { isChunkLoadError, isReloadingForNewVersion } from '../lib/staleDeploy'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  /** The error was a code file that couldn't be downloaded (see lib/staleDeploy). */
  chunkError: boolean
}

/**
 * Catches render-time errors anywhere below it and swaps in a branded
 * full-screen fallback instead of a white screen. Recovery is a hard
 * reload — the safest reset for an SPA in an unknown broken state.
 *
 * A failed code download almost always means the site was updated while this
 * tab was open (the old files are gone), so that case says so in plain words
 * instead of "Something broke".
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, chunkError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, chunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.state.chunkError) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false
      const reloading = isReloadingForNewVersion()
      return (
        <div className="relative min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
          <div className="relative w-full max-w-sm text-center animate-fade-in" role="alert">
            <img src="/favicon.svg" alt="" className="w-16 h-16 mx-auto mb-4 rounded-2xl border-2 border-night-900 shadow-sticker" />
            <h1 className="h-poster-sm mb-3">
              {offline ? 'You are offline' : 'A new version of WingKingTony is available'}
            </h1>
            <p className="text-sm text-charcoal-600 leading-relaxed mb-6">
              {offline
                ? "This page couldn't load because there is no internet connection. Connect to the internet, then tap Reload."
                : reloading
                  ? 'Loading the new version…'
                  : 'The site was updated while this page was open. Tap Reload to get the new version.'}
            </p>
            <button onClick={this.handleReload} className="btn-primary">
              Reload
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="relative min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-8 w-[420px] h-[280px] bg-splatter opacity-20" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 w-[420px] h-[280px] bg-splatter opacity-15 rotate-180" />

        <div className="relative w-full max-w-sm text-center animate-fade-in">
          <div className="text-5xl mb-4">🔥</div>
          <p className="eyebrow mb-2">Grease fire</p>
          <h1 className="h-poster-sm mb-3">Something broke</h1>
          <p className="text-sm text-charcoal-600 leading-relaxed mb-6">
            This page hit an error and couldn't be shown.
            Tap Reload to try again.
          </p>
          <button onClick={this.handleReload} className="btn-primary">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
