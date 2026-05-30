import '@testing-library/jest-dom'

// jsdom doesn't implement window.matchMedia. Provide a mock that resolves
// max-width / min-width queries against the current window.innerWidth so
// breakpoint-sensitive hooks work correctly in tests.
if (typeof window !== 'undefined' && !window.matchMedia) {
  const evaluate = (query: string): boolean => {
    const max = /\(max-width:\s*(\d+)px\)/.exec(query)
    if (max) return window.innerWidth <= Number(max[1])
    const min = /\(min-width:\s*(\d+)px\)/.exec(query)
    if (min) return window.innerWidth >= Number(min[1])
    return false
  }
  window.matchMedia = (query: string) => ({
    get matches() { return evaluate(query) },
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}
