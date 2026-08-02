import { useId, type ReactNode } from 'react';
import { CiDefsContext, useCiDefs } from './ciDefs.ts';

export function CiDefsProvider({ children }: { children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <CiDefsContext.Provider value={`ci${uid}`}>{children}</CiDefsContext.Provider>;
}

/**
 * Global defs block from the approved preview — halo gradient, cells /
 * cellsMark patterns, fade — hoisted once per page copy so every figure
 * (desktop + mobile) can resolve url(#…) regardless of display:none toggles.
 */
export function CiSharedDefs() {
  const { id } = useCiDefs();

  return (
    <svg className="ci-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <radialGradient id={id('halo')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="rgba(238,74,38,.3)" />
          <stop offset="1" stopColor="rgba(238,74,38,0)" />
        </radialGradient>
        <pattern id={id('cells')} width="30" height="20" patternUnits="userSpaceOnUse">
          <rect width="18" height="10" fill="rgba(255,255,255,.06)" />
        </pattern>
        <pattern id={id('cellsMark')} width="90" height="60" patternUnits="userSpaceOnUse">
          <rect x="30" y="20" width="18" height="10" fill="rgba(255,255,255,.13)" />
          <line x1="33" y1="25" x2="45" y2="25" stroke="rgba(16,16,16,.9)" />
          <rect x="60" y="40" width="18" height="10" fill="rgba(255,255,255,.09)" />
          <line x1="63" y1="45" x2="75" y2="45" stroke="rgba(16,16,16,.9)" />
        </pattern>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="white" stopOpacity=".5" />
          <stop offset=".3" stopColor="white" stopOpacity="1" />
          <stop offset="1" stopColor="white" stopOpacity=".8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
