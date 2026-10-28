import { useEffect, useSyncExternalStore } from 'react'

// Any open sheet, modal or overlay can ask the floating "Rate wings" button to
// step aside so it never covers that surface's own buttons or text. A counter
// (not a boolean) so nested/overlapping surfaces don't un-hide each other.
let hiders = 0
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Hide the floating "Rate wings" button while `active` is true. */
export function useHideFab(active = true) {
  useEffect(() => {
    if (!active) return
    hiders += 1
    emit()
    return () => {
      hiders -= 1
      emit()
    }
  }, [active])
}

/** True while at least one surface has asked the floating button to hide. */
export function useFabHidden() {
  return useSyncExternalStore(subscribe, () => hiders > 0, () => false)
}
