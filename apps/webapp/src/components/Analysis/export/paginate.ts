import { BLOCK_GAP_MAX, BLOCK_GAP_MIN } from "./exportTheme.ts";

/** One measured block of the document, in the order it reads. */
export interface MeasuredBlock {
  id: string;
  height: number;
  /** Start a fresh page before this block even if it would fit on the current one. */
  breakBefore?: boolean;
}

export interface PlacedBlock {
  id: string;
  /** 1 unless the block is taller than a page on its own, in which case it is shrunk to fit. */
  scale: number;
}

/**
 * A shrunk block is laid out wider and scaled back down, and text can re-wrap when a column grows.
 * A hair under the page height absorbs that rather than clipping the last lane against the footer.
 */
const FIT_SAFETY = 0.99;

export interface PagePlan {
  blocks: PlacedBlock[];
  /** Gap between the blocks on this page, chosen so the page fills without stretching. */
  gap: number;
}

/**
 * Lay the document out onto A4 pages.
 *
 * Greedy and deliberately simple: blocks are whole, so nothing is ever cut through the middle of a
 * chart, and the only thing the packer decides is where the page turns. A block that cannot fit on
 * a page by itself (a long track's Timeline, where every lane and every ribbon row is stacked) is
 * given its own page and scaled down to fit rather than split across two, because half a timeline
 * on each of two pages is unreadable in a way a 6% smaller one is not.
 *
 * The gap is then spread to fill the page up to `BLOCK_GAP_MAX`. Beyond that the leftover is left
 * at the foot of the page: air between two sections is spacing, air between two rows of one card
 * grid is a mistake.
 */
export function paginate(blocks: MeasuredBlock[], contentH: number): PagePlan[] {
  const pages: PagePlan[] = [];
  let current: MeasuredBlock[] = [];

  const flush = () => {
    if (!current.length) return;
    const used = current.reduce((sum, b) => sum + Math.min(b.height, contentH), 0);
    const slack = contentH - used;
    const gaps = current.length - 1;
    const gap = gaps > 0 ? Math.max(BLOCK_GAP_MIN, Math.min(BLOCK_GAP_MAX, slack / gaps)) : 0;
    pages.push({
      blocks: current.map((b) => ({ id: b.id, scale: b.height > contentH ? (contentH / b.height) * FIT_SAFETY : 1 })),
      gap,
    });
    current = [];
  };

  for (const block of blocks) {
    if (block.height > contentH) {
      // Taller than a whole page: it gets one to itself, shrunk to fit.
      flush();
      current = [block];
      flush();
      continue;
    }
    if (block.breakBefore) flush();
    const used = current.reduce((sum, b) => sum + b.height, 0) + current.length * BLOCK_GAP_MIN;
    if (current.length && used + block.height > contentH) flush();
    current.push(block);
  }
  flush();

  return pages;
}
