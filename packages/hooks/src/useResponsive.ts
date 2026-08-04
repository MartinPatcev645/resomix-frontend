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

export function useResponsive({ ssrSafe = false }: ResponsiveOptions = {}) {
  const [isDesktop, setIsDesktop] = useState(() => {
    // Prerender, and (when ssrSafe) the hydrating render: assume desktop, matching the build.
    if (ssrSafe || typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });

  /* Measure before paint, not after: this is the render that corrects the hydration assumption
     above, so a plain effect would let one wrong frame reach the screen. */
  useIsomorphicLayoutEffect(() => {
    setIsDesktop(window.innerWidth >= 1024);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Remove event listener on cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isDesktop, isMobile: !isDesktop };
}
