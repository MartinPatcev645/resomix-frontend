import { useEffect, useRef } from "react";
import { initSineWaves } from "./raw/sineWaves";

/**
 * Displays an animated set of sine waves using a canvas element. The canvas
 * is injected at runtime and automatically resized to fill the parent. The
 * animation is entirely GPU-accelerated via the 2D canvas API.
 */
export const SineWaves: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initSineWaves(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
}; 