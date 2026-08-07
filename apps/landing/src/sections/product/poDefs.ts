import { createContext, useContext } from 'react';

/**
 * Prefix for the page's SVG def ids.
 *
 * SideLines mounts a desktop and a mobile copy of every page, one of which is
 * always display:none. With one fixed id per def, url(#…) resolves to whichever
 * carrier comes first in the document — and a def inside a display:none subtree
 * paints nothing. Each copy therefore gets its own useId-derived prefix.
 */
export const PoDefsContext = createContext('po');

/** `id('cells')` for definitions, `url('cells')` for references. */
export function usePoDefs() {
  const prefix = useContext(PoDefsContext);
  return {
    id: (name: string) => `${prefix}-${name}`,
    url: (name: string) => `url(#${prefix}-${name})`,
  };
}

