import { useEffect, useRef } from "react";
import { initStaticNoise } from "./raw/staticNoise";

export interface StaticNoiseProps {
  /** Frames per second for noise updates */
  fps?: number;
  /** Background color for the overall page (html & body). */
  pageBg?: string;
  /** Background color for the canvas element. */
  canvasBg?: string;
  /** Extra Tailwind / CSS classes for wrapper */
  className?: string;
}

/**
 * React wrapper around a static noise Canvas animation (old TV snow).
 * Example usage:
 *   <StaticNoise color="#ffffff" fps={20} className="opacity-70" />
 */
export const StaticNoise: React.FC<StaticNoiseProps> = ({
  className = "",
  pageBg = "#323233",
  canvasBg = "#323233",
  fps = 30,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;

    // Store previous backgrounds so we can restore on unmount
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = document.documentElement.style.background;

    if (pageBg) {
      document.body.style.background = pageBg;
      document.documentElement.style.background = pageBg;
    }

    const dispose = initStaticNoise(boxRef.current, {
      fps,
      canvasBg,
    });

    return () => {
      dispose();
      // restore backgrounds
      if (pageBg) {
        document.body.style.background = prevBodyBg;
        document.documentElement.style.background = prevHtmlBg;
      }
    };
  }, [fps, pageBg, canvasBg]);

  return (
    <div
      ref={boxRef}
      className={
        "relative w-full h-full overflow-hidden pointer-events-none " + className
      }
    />
  );
}; 