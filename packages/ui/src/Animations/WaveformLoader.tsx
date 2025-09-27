import { useEffect, useRef } from "react";
import { initWaveformLoader } from "./raw/waveformLoader";

/**
 * Displays an animated waveform loader using SVG elements. The animation
 * creates multiple colorful waveforms that flow smoothly across the container.
 * Based on D3.js circle wave patterns with smooth curves and blend modes.
 */
export const WaveformLoader: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initWaveformLoader(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
