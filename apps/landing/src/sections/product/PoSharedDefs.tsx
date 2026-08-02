import { useId, type ReactNode } from 'react';
import { PoDefsContext, usePoDefs } from './poDefs.ts';

export function PoDefsProvider({ children }: { children: ReactNode }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <PoDefsContext.Provider value={`po${uid}`}>{children}</PoDefsContext.Provider>;
}

/**
 * Global defs block from the approved preview — halo gradient, cells /
 * cellsMark patterns — hoisted once per page copy so every figure
 * (desktop + mobile) can resolve url(#…) regardless of display:none toggles.
 * Pattern sizes match the preview exactly (26×17 / 78×51), not CI's 30×20.
 */
export function PoSharedDefs() {
  const { id } = usePoDefs();

  return (
    <svg className="po-defs" aria-hidden="true" focusable="false" width="0" height="0">
      <defs>
        <radialGradient id={id('halo')} cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="rgba(238,74,38,.3)" />
          <stop offset="1" stopColor="rgba(238,74,38,0)" />
        </radialGradient>
        <pattern id={id('cells')} width="26" height="17" patternUnits="userSpaceOnUse">
          <rect width="15" height="9" fill="rgba(255,255,255,.06)" />
        </pattern>
        <pattern id={id('cellsMark')} width="78" height="51" patternUnits="userSpaceOnUse">
          <rect x="26" y="17" width="15" height="9" fill="rgba(255,255,255,.13)" />
          <line x1="29" y1="21.5" x2="38" y2="21.5" stroke="rgba(16,16,16,.9)" />
          <rect x="52" y="34" width="15" height="9" fill="rgba(255,255,255,.09)" />
          <line x1="55" y1="38.5" x2="64" y2="38.5" stroke="rgba(16,16,16,.9)" />
        </pattern>
      </defs>
    </svg>
  );
}
