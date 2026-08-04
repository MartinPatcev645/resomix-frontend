import '@testing-library/jest-dom'
import { server } from './server.ts'

/**
 * jsdom implements neither observer API, and several workspace components construct one on mount.
 * Without these, any test that renders the real app tree dies on `IntersectionObserver is not
 * defined` — which is a gap in the environment, not a fault in the component, and it was enough to
 * stop the app-level smoke test from rendering the shell at all.
 *
 * Inert stubs: they record nothing and fire no callbacks, which is what a test that isn't asserting
 * on scrolling or resizing wants.
 */
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return [] }
  root = null
  rootMargin = ''
  thresholds: number[] = []
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = InertObserver as unknown as typeof IntersectionObserver
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = InertObserver as unknown as typeof ResizeObserver
}

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

/* jsdom implements no matchMedia. `useResponsive` asks it for the `lg` breakpoint (it must use the
   same signal as Tailwind's `lg:`, because window.innerWidth diverges from the CSS viewport under
   browser zoom), so without this every component that branches on viewport throws on mount.
   `matches: false` = the mobile branch, matching this suite's default jsdom width. */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})
