import { useId, type ReactNode } from 'react';
import { MpDefsContext, useMpDefs } from './mpDefs.ts';

export function MpDefsProvider({ children }: { children: ReactNode }) {
  // useId wraps its counter in punctuation that varies by React version; keep
  // the prefix alphanumeric so url(#…) needs no escaping.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <MpDefsContext.Provider value={`mp${uid}`}>{children}</MpDefsContext.Provider>;
}

/**
 * Every gradient, pattern and mask used by the page figures, hoisted into one
 * zero-size carrier at the top of the page.
 *
 * The desktop and mobile variant of each figure are toggled with display:none,
 * so a def that lived inside the hidden SVG would stop resolving at the other
 * breakpoint (the S3 mobile figure references cellsC/D/E, which the preview only
 * declared inside its desktop SVG). Hoisting them makes every reference
 * breakpoint-independent.
 */
export function MpSharedDefs() {
  const { id } = useMpDefs();

  return (
    <svg className="mp-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <radialGradient id={id('haloA')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="rgba(238,74,38,.3)" />
          <stop offset="1" stopColor="rgba(238,74,38,0)" />
        </radialGradient>
        <radialGradient id={id('haloAm')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="rgba(238,74,38,.3)" />
          <stop offset="1" stopColor="rgba(238,74,38,0)" />
        </radialGradient>

        <pattern id={id('cellsA')} width="30" height="20" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="18" height="10" fill="rgba(255,255,255,.055)" />
        </pattern>
        <pattern id={id('cellsB')} width="90" height="60" patternUnits="userSpaceOnUse">
          <rect x="30" y="20" width="18" height="10" fill="rgba(255,255,255,.13)" />
          <rect x="60" y="40" width="18" height="10" fill="rgba(255,255,255,.09)" />
        </pattern>
        <pattern id={id('cellsAm')} width="28" height="19" patternUnits="userSpaceOnUse">
          <rect width="16" height="9" fill="rgba(255,255,255,.06)" />
        </pattern>
        <pattern id={id('cellsBm')} width="84" height="57" patternUnits="userSpaceOnUse">
          <rect x="28" y="19" width="16" height="9" fill="rgba(255,255,255,.13)" />
        </pattern>
        <pattern id={id('cellsC')} width="26" height="18" patternUnits="userSpaceOnUse">
          <rect width="15" height="9" fill="rgba(255,255,255,.16)" />
        </pattern>
        <pattern id={id('cellsD')} width="26" height="18" patternUnits="userSpaceOnUse">
          <rect width="15" height="9" fill="rgba(255,255,255,.055)" />
        </pattern>
        <pattern id={id('cellsE')} width="26" height="18" patternUnits="userSpaceOnUse">
          <rect width="15" height="9" fill="rgba(255,255,255,.22)" />
        </pattern>
        <pattern id={id('cellsF')} width="24" height="16" patternUnits="userSpaceOnUse">
          <rect width="14" height="8" fill="rgba(255,255,255,.09)" />
        </pattern>

        <linearGradient id={id('fieldFade')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity=".55" />
          <stop offset=".25" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity=".85" />
        </linearGradient>
        <mask id={id('fieldMaskA')}>
          <rect x="330" y="60" width="820" height="320" fill={`url(#${id('fieldFade')})`} />
        </mask>
      </defs>
    </svg>
  );
}
