import { NAV_GLYPHS, type NavGlyphKey } from './navGlyphMap.tsx';

export type { NavGlyphKey };

export function NavGlyph({ name }: { name: NavGlyphKey }) {
  return NAV_GLYPHS[name];
}
