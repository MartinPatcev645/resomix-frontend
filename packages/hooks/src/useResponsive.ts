import { useState, useEffect } from "react";
import { useIsomorphicLayoutEffect } from "./useHydrated";

interface ResponsiveOptions {
  /**
   * Set this in an app whose HTML is prerendered at build time.
   *
   * The build has no window, so it has to assume a viewport — it assumes desktop. If the first
   * client render then measured the real window, a phone would produce different markup than the
   * HTML it is hydrating, and React would throw the whole prerendered tree away.
   *
   * With this on, the first render repeats the build's assumption and the real measurement happens
   * in the layout effect below, which runs BEFORE the browser paints. A phone therefore never
   * displays the desktop shell — it is corrected within the same frame.
   */
  ssrSafe?: boolean;
}

/**
 * Must stay identical to Tailwind's `lg` breakpoint. The layout branches on BOTH this hook and on
 * `lg:` utilities, so if the two disagree the page renders one breakpoint's markup inside the
 * other's styling.
 */
const DESKTOP_QUERY = '(min-width: 1024px)';

/**
 * Asked via matchMedia, NOT `window.innerWidth` — they are not the same number.
 *
 * Under browser zoom, `innerWidth` reports the layout viewport scaled by the zoom factor, while
 * media queries and every CSS length resolve against the real CSS viewport. Zoomed out on a narrow
 * window we measured `innerWidth: 1258` while `documentElement.clientWidth` was 400 and
 * `(min-width: 1024px)` was false. So this hook said "desktop" and rendered the desktop navbar and
 * footer, while the stylesheets laid the page out for mobile — desktop content crushed into a
 * mobile-scaled frame.
 *
 * matchMedia is the same signal Tailwind compiles `lg:` to, so the two cannot drift.
 */
const isDesktopNow = () => window.matchMedia(DESKTOP_QUERY).matches;

export function useResponsive({ ssrSafe = false }: ResponsiveOptions = {}) {
  const [isDesktop, setIsDesktop] = useState(() => {
    // Prerender, and (when ssrSafe) the hydrating render: assume desktop, matching the build.
    if (ssrSafe || typeof window === 'undefined') return true;
    return isDesktopNow();
  });

  /* Measure before paint, not after: this is the render that corrects the hydration assumption
     above, so a plain effect would let one wrong frame reach the screen. */
  useIsomorphicLayoutEffect(() => {
    setIsDesktop(isDesktopNow());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);

    // `change` covers zoom as well as resize; a `resize` listener alone misses zoom entirely.
    mq.addEventListener('change', onChange);
    onChange();

    return () => mq.removeEventListener('change', onChange);
  }, []);

  return { isDesktop, isMobile: !isDesktop };
}
