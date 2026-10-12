import { NAV_GLYPHS, type NavGlyphKey } from './navGlyphMap';

export type { NavGlyphKey };

export function NavGlyph({ name }: { name: NavGlyphKey }) {
  return NAV_GLYPHS[name];
}
