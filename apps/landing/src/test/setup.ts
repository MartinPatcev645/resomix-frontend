import '@testing-library/jest-dom'
import { server } from './server.ts'
import i18n from '../i18n.ts'

/*
 * Register every page's locale slice for tests.
 *
 * In production each slice is fetched alongside its route chunk by `routes/pageLoaders.ts`, so a
 * component always mounts with its strings present. Tests render sections directly and bypass that
 * loader, so without this they would see raw keys ("partners.hero.title") instead of copy.
 *
 * eager: true — these are small JSON files and the setup must be synchronous.
 */
const slices = import.meta.glob('../locales/en/pages/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>
for (const mod of Object.values(slices)) {
  i18n.addResourceBundle('en', 'common', mod.default, true, true)
}

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

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})

Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: () => {},
})

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
