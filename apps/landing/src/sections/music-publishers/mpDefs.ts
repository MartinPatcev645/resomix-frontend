import { createContext, useContext } from 'react';

/**
 * Prefix for the page's SVG def ids.
 *
 * SideLines mounts a desktop and a mobile copy of every page, one of which is
 * always display:none. With one fixed id per def, url(#…) resolves to whichever
 * carrier comes first in the document — and a def inside a display:none subtree
 * paints nothing, which silently dropped the mobile matrices and halos. Each
 * copy therefore gets its own useId-derived prefix (see MpDefsProvider).
 */
export const MpDefsContext = createContext('mp');

/** `id('cellsA')` for definitions, `url('cellsA')` for references. */
export function useMpDefs() {
  const prefix = useContext(MpDefsContext);
  return {
    id: (name: string) => `${prefix}-${name}`,
    url: (name: string) => `url(#${prefix}-${name})`,
  };
}
