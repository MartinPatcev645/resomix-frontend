import { useEffect, useRef } from "react";
import noiseImg from "@/assets/noise-transparent.png";

// Animate two layers of noise by randomising their background positions
function animate(layerA: HTMLElement, layerB: HTMLElement) {
  const rand = () => Math.floor(Math.random() * 300); // noise tile is 300×300

  const tick = () => {
    layerA.style.backgroundPosition = `-${rand()}px -${rand()}px`;
    layerB.style.backgroundPosition = `-${rand()}px -${rand()}px`;
  };

  // 10 times per second → 100 ms interval
  tick(); // initial jitter
  const id = window.setInterval(tick, 100);
  return () => clearInterval(id);
}

interface BackgroundNoiseProps {
  opacity?: number;
  zIndex?: number;
  className?: string;
}

export function BackgroundNoise({
  opacity = 1,
  zIndex = 10,
  className = "overflow-clip"
}: BackgroundNoiseProps) {
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!layerARef.current || !layerBRef.current) return;
    return animate(layerARef.current, layerBRef.current);
  }, []);

  return (
    <div
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        backgroundImage: `url(${noiseImg})`,
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
        opacity,
        zIndex,
      }}
      aria-hidden="true"
    >
      {/* animated noise layer 1 */}
      <div
        ref={layerARef}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseImg})`,
          backgroundSize: 'auto',
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top left',
          opacity,
          zIndex,
        }}
        aria-hidden="true"
      />

      {/* animated noise layer 2 (slightly zoomed) */}
      <div
        ref={layerBRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${noiseImg})`,
          backgroundSize: 'auto',
          backgroundRepeat: 'repeat',
          backgroundPosition: 'top left',
          opacity,
          zIndex,
          transform: 'scale(1.05)',
        }}
        aria-hidden="true"
      />
    </div>
  );
}
