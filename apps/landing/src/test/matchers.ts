/**
 * Accessible-name matcher that ignores soft hyphens.
 *
 * The landing copy carries U+00AD inside long words so headings can break cleanly on narrow
 * screens. It is invisible and carries no meaning, but it lands in the accessible name, so a
 * plain /catalogue/i regex stops matching "cata­logue". Tests should assert on what a
 * reader perceives, not on where a hyphenation hint happens to sit.
 */
export const softHyphenName =
  (pattern: RegExp) =>
  (accessibleName: string): boolean =>
    pattern.test(accessibleName.replace(/­/g, ''));
