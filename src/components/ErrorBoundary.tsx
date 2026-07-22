import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render-time errors anywhere below it and swaps in a branded
 * full-screen fallback instead of a white screen. Recovery is a hard
 * reload — the safest reset for an SPA in an unknown broken state.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="relative min-h-dvh bg-paper flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-12 -right-8 w-[420px] h-[280px] bg-splatter opacity-20" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 -left-12 w-[420px] h-[280px] bg-splatter opacity-15 rotate-180" />

        <div className="relative w-full max-w-sm text-center animate-fade-in">
          <div className="text-5xl mb-4">🔥</div>
          <p className="eyebrow mb-2">Grease fire</p>
          <h1 className="h-poster-sm mb-3">Something broke</h1>
          <p className="text-sm text-charcoal-600 leading-relaxed mb-6">
            The kitchen hit a snag and this screen couldn't be served.
            A reload usually clears it right up.
          </p>
          <button onClick={this.handleReload} className="btn-primary">
            Reload
          </button>
        </div>
      </div>
    )
  }
}
