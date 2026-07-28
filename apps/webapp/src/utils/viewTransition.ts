/**
 * Feature-detected View Transitions wrapper (Router 6.23 has no native API).
 * Unsupported browsers and prefers-reduced-motion users get an instant update.
 */
export function withViewTransition(update: () => void): void {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!reduced && typeof d.startViewTransition === "function") d.startViewTransition(update);
  else update();
}
