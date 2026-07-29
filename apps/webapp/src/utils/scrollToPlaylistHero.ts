/**
 * Smoothly bring the playlist hero to the top of the viewport once a playlist has loaded on
 * /sonic-discovery?id=… — so opening a playlist lands on the hero instead of the workspace header
 * and task cards that sit above it in the shell.
 *
 * Waits two frames so the hero has painted (it renders only after the async playlist fetch),
 * respects prefers-reduced-motion, and no-ops when the hero is already at/above the top so it never
 * nudges a view the user is already looking at.
 */
export function scrollToPlaylistHero(el: HTMLElement | null): void {
  if (typeof window === "undefined" || !el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 0) return; // already at or above the top — nothing to reveal
      const targetY = Math.max(0, window.scrollY + rect.top);
      window.scrollTo({ top: targetY, behavior: reduce ? "auto" : "smooth" });
    });
  });
}
