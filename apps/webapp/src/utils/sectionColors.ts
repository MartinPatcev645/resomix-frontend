/**
 * Which colour a structure section is drawn in.
 *
 * Keyed by the DISPLAYED word ("groove" for "groove 2"), never the canonical class: a groove
 * track's sections are stored as `drop` but shown as "groove", and the colour has to match what
 * the block says. The colours themselves are the `--section-*` tokens in `styles/sections.css`,
 * fixed by the approved design so the same word is the same colour on every track.
 *
 * These are all 17 words the structure reading can show, grouped by role. Anything else (an older
 * reading's word, or a word added later without a token) is drawn as "part", per the handoff.
 */
export type SectionGroup = "openers" | "rise" | "peak" | "sustain" | "release" | "descent" | "close";

export const SECTION_WORD_GROUPS: Readonly<Record<string, SectionGroup>> = {
  intro: "openers",
  opening: "openers",
  build: "rise",
  swell: "rise",
  drop: "peak",
  main: "peak",
  full: "peak",
  groove: "sustain",
  part: "sustain",
  breakdown: "release",
  break: "release",
  sparse: "release",
  cooldown: "descent",
  "wind-down": "descent",
  fade: "descent",
  outro: "close",
  closing: "close",
};

const FALLBACK_WORD = "part";

export interface SectionTone {
  /** Block fill. */
  bg: string;
  /** Label, top stripe and inner edge. */
  fg: string;
}

export function sectionTone(word: string): SectionTone {
  const key = word.trim().toLowerCase();
  const known = Object.hasOwn(SECTION_WORD_GROUPS, key) ? key : FALLBACK_WORD;
  return { bg: `var(--section-${known}-bg)`, fg: `var(--section-${known}-fg)` };
}
