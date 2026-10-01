import React from "react";

// function to Convert seconds to hours, minutes and seconds
export function formatDuration(seconds: number): string {
  if (seconds < 0) return "0:00";
  
  // Convert to int because we're getting float from the API now
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (hours > 0) {
    // Format: "H:MM:SS"
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    // Format: "M:SS"
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  } else {
    // Format: "0:SS"
    return `0:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

// Function to convert 0-1 points into a percentage
export function formatPercentage(percentage: number, decimals: number = 2): string {
  return `${(percentage * 100).toFixed(decimals)}%`;
}

/**
 * Display form of a model genre/style label. The genre model emits hierarchical labels
 * joined by "---" (e.g. "Electronic---Ambient", "Electronic---House---Deep House"); we show only
 * the most-specific leaf ("Ambient", "Deep House"). No-op for plain labels ("Afro House").
 *
 * Single source of truth for both the Analysis page's Top-genre field and the Library card's
 * genre pill, so the two always read identically.
 */
export function shortGenre(label: string): string {
  return label.split("---").pop() ?? label;
}

/**
 * True when a click on an <a> should be left to the browser (open in a new tab / window) rather
 * than intercepted for SPA navigation: a modifier key (⌘/Ctrl/Shift/Alt) or a non-primary button
 * (middle-click). Use inside an anchor's onClick — return early when true, otherwise
 * `e.preventDefault()` + `navigate(...)`. Keeps real `href`s so right-click "Open in new tab" and
 * ⌘/Ctrl-click work, while a plain click stays an in-app transition.
 */
export function shouldOpenInNewTab(e: {
  metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number;
}): boolean {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}
