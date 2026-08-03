import React from 'react';

/**
 * Renders a hero headline in which one phrase is accent-coloured.
 *
 * Which words carry the emphasis is a copy decision, not a layout one, so it is marked in the
 * translation string itself with double brackets:
 *
 *   "Hear the [[Invisible]]"                      → emphasis at the end
 *   "[[One API.]] Search, similarity and ..."     → emphasis at the start
 *   "Drop one track.\nFind what [[belongs next.]]" → \n becomes a line break
 *
 * The alternative — a `h1Lead` + `h1Em` key pair per page, which the older heroes use — forces the
 * emphasis to sit at a fixed position and needs a code change to move it. Marking it inline keeps
 * the whole headline readable as one string and lets copy move the accent without touching a
 * component.
 *
 * There is exactly one <h1> per hero and the accent is a plain colour rule, so mobile and desktop
 * render identically by construction — no breakpoint-specific markup to keep in step.
 */

interface HeroTitleProps {
  /** Raw translated string, may contain [[emphasis]] and \n. */
  text: string;
  /** Page-scoped class carrying the accent colour, e.g. "hm-em". */
  emClass: string;
}

const EM = /\[\[(.+?)\]\]/g;

export function HeroTitle({ text, emClass }: HeroTitleProps) {
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 ? <br /> : null}
          {renderLine(line, emClass)}
        </React.Fragment>
      ))}
    </>
  );
}

function renderLine(line: string, emClass: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;

  // Fresh regex per call: a module-level /g regex carries lastIndex between calls.
  const re = new RegExp(EM.source, 'g');
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index));
    out.push(
      <span key={`${m.index}`} className={emClass}>
        {m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));

  // No markers: return the string untouched rather than an array, so an un-marked headline is
  // rendered exactly as it was before.
  return out.length ? out : line;
}
