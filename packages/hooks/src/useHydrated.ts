import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * `useLayoutEffect` that does not warn during prerendering.
 *
 * React logs "useLayoutEffect does nothing on the server" when a layout effect is reached in a
 * server render. There is no layout to measure there, so the effect is genuinely a no-op — but the
 * warning is noise in the build output, and on the client we specifically WANT layout timing:
 * effects that correct a value chosen for hydration must run before the browser paints, otherwise
 * the user sees the pre-correction frame.
 */
export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * False during the first client render, true from the moment hydration has committed.
 *
 * Marketing pages are prerendered to static HTML at build time, so React's first client render has
 * to produce **exactly** the markup the build produced — otherwise hydration mismatches and React
 * throws the server HTML away and re-renders the whole subtree, which is both slower than no
 * prerendering at all and noisy in the console.
 *
 * Anything the build could not know is therefore rendered in its "unknown" state for that first
 * render and corrected immediately afterwards. Two things qualify:
 *
 *   - **auth** — persisted in localStorage, so the client knows the visitor is signed in but the
 *     build never could
 *   - **viewport** — the build has no window, so it cannot know whether this is a phone
 *
 * The flip happens in a LAYOUT effect, so the corrected render is committed before the browser
 * paints: a signed-in visitor does not see a flash of the signed-out header.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useIsomorphicLayoutEffect(() => setHydrated(true), []);
  return hydrated;
}
