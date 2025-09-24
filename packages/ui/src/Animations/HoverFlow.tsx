import React from "react";

export interface HoverFlowProps {
  text: string;
  /** Maximum characters to show in the default truncated state */
  maxChars: number;
  /** CSS width for the visible area (e.g., "240px" or "var(--px-200)") */
  maxWidth: string;
  /** Scroll speed in pixels per second when animating */
  speed?: number;
  /** Hover delay in milliseconds before starting animation */
  delay?: number;
  /** Pause duration in milliseconds when reaching the end before looping */
  endPause?: number;
  /** Pause duration in milliseconds when text resets to start before flowing again. Defaults to half of endPause */
  startPause?: number;
  /** If true, flow continuously without requiring hover */
  flowAlways?: boolean;
  /** Optional click handler on the container */
  onClick?: () => void;
  className?: string;
}

/**
 * HoverFlow – shows a truncated string (by characters) with ellipsis. When hovered for the specified delay,
 * it starts smoothly scrolling the full text horizontally within the maxWidth viewport, looping while hovered.
 * If flowAlways is true, it continuously flows without requiring hover.
 * Text inherits its styling from the parent; this component applies only layout/overflow for the effect.
 */
export const HoverFlow: React.FC<HoverFlowProps> = ({
  text,
  maxChars,
  maxWidth,
  speed = 60,
  delay = 400,
  endPause = 0,
  startPause,
  flowAlways = false,
  onClick,
  className = "",
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);
  const contentRef = React.useRef<HTMLSpanElement>(null);

  const [isHovered, setIsHovered] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);

  const hoverTimerRef = React.useRef<number | null>(null);
  const pauseTimerRef = React.useRef<number | null>(null);
  const startPauseTimerRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTsRef = React.useRef<number | null>(null);
  const maxScrollRef = React.useRef(0);
  const offsetRef = React.useRef(0);

  // Calculate effective startPause (defaults to half of endPause)
  const effectiveStartPause = startPause ?? Math.floor(endPause / 2);

  // Truncated presentation string
  const truncated = React.useMemo(() => {
    if (text.length <= maxChars) return text;
    return text.slice(0, Math.max(0, maxChars)).trimEnd() + "...";
  }, [text, maxChars]);

  const applyTransform = React.useCallback((offsetPx: number) => {
    const node = contentRef.current;
    if (node) {
      node.style.transform = `translateX(${-offsetPx}px)`;
    }
  }, []);

  const cleanupTimers = React.useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (pauseTimerRef.current) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (startPauseTimerRef.current) {
      window.clearTimeout(startPauseTimerRef.current);
      startPauseTimerRef.current = null;
    }
  }, []);

  const stopAnimation = React.useCallback(() => {
    cleanupTimers();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
    offsetRef.current = 0;
    applyTransform(0);
    setIsAnimating(false);
  }, [applyTransform, cleanupTimers]);

  const step = React.useCallback(
    (ts: number) => {
      // If not flowAlways and hover ended, bail out
      if (!flowAlways && !containerRef.current?.matches(":hover")) return;

      const last = lastTsRef.current ?? ts;
      const dt = (ts - last) / 1000; // seconds
      lastTsRef.current = ts;

      const maxScroll = maxScrollRef.current;
      if (maxScroll <= 0) {
        applyTransform(0);
      } else {
        let next = offsetRef.current + speed * dt;
        if (next >= maxScroll) {
          // Reached the end; pause if required then loop
          next = maxScroll;
          offsetRef.current = next;
          applyTransform(next);

          if (endPause > 0 && pauseTimerRef.current == null) {
            // Pause: stop RAF, wait, then restart from 0
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            pauseTimerRef.current = window.setTimeout(() => {
              pauseTimerRef.current = null;
              lastTsRef.current = null;
              offsetRef.current = 0;
              applyTransform(0);
              
              // Apply startPause before beginning the next cycle
              if (effectiveStartPause > 0) {
                startPauseTimerRef.current = window.setTimeout(() => {
                  startPauseTimerRef.current = null;
                  rafRef.current = requestAnimationFrame(step);
                }, effectiveStartPause) as unknown as number;
              } else {
                rafRef.current = requestAnimationFrame(step);
              }
            }, endPause) as unknown as number;
            return;
          } else if (endPause <= 0) {
            // No pause, wrap immediately but still apply startPause
            if (effectiveStartPause > 0) {
              if (rafRef.current) cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              lastTsRef.current = null;
              offsetRef.current = 0;
              applyTransform(0);
              
              startPauseTimerRef.current = window.setTimeout(() => {
                startPauseTimerRef.current = null;
                rafRef.current = requestAnimationFrame(step);
              }, effectiveStartPause) as unknown as number;
              return;
            } else {
              next = 0;
            }
          }
        }

        offsetRef.current = next;
        applyTransform(next);
      }

      rafRef.current = requestAnimationFrame(step);
    },
    [applyTransform, speed, endPause, flowAlways, effectiveStartPause]
  );

  const startAfterDelay = React.useCallback(() => {
    const container = containerRef.current;
    const measureEl = measureRef.current;
    if (!container || !measureEl) return;

    const containerWidth = container.clientWidth;
    const textWidth = measureEl.scrollWidth; // width of full text (no wrap)
    maxScrollRef.current = Math.max(0, textWidth - containerWidth);

    // Only animate if there is overflow
    if (maxScrollRef.current <= 0) return;

    setIsAnimating(true);
    lastTsRef.current = null;
    offsetRef.current = 0;
    applyTransform(0);
    rafRef.current = requestAnimationFrame(step);
  }, [applyTransform, step]);

  const handleMouseEnter = React.useCallback(() => {
    // Don't start on hover if flowAlways is true (it's already running)
    if (flowAlways) return;
    
    setIsHovered(true);
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      // Check if still hovered after delay to avoid stale state
      if (containerRef.current?.matches(":hover")) {
        startAfterDelay();
      }
    }, delay) as unknown as number;
  }, [delay, startAfterDelay, flowAlways]);

  const handleMouseLeave = React.useCallback(() => {
    // Don't stop on mouse leave if flowAlways is true
    if (flowAlways) return;
    
    setIsHovered(false);
    stopAnimation();
  }, [stopAnimation, flowAlways]);

  // Start animation automatically if flowAlways is true
  React.useEffect(() => {
    if (flowAlways) {
      startAfterDelay();
    }
    return () => {
      if (flowAlways) {
        stopAnimation();
      }
    };
  }, [flowAlways, startAfterDelay, stopAnimation]);

  // Cleanup on unmount
  React.useEffect(() => stopAnimation, [stopAnimation]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={className}
      style={{
        maxWidth: maxWidth,
        overflow: "hidden",
        display: "inline-block",
        verticalAlign: "bottom",
        whiteSpace: "nowrap",
      }}
    >
      {/* Default truncated content (visible when not animating) */}
      {!isAnimating && <span>{truncated}</span>}

      {/* Scrolling full content (visible when animating) */}
      {isAnimating && (
        <span
          ref={contentRef}
          style={{
            display: "inline-block",
            willChange: "transform",
            transform: "translateX(0)",
          }}
        >
          {text}
        </span>
      )}

      {/* Hidden measure element for full width calculation */}
      <span
        ref={measureRef}
        aria-hidden
        style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap" }}
      >
        {text}
      </span>
    </div>
  );
}; 