import { useEffect, useRef } from "react";
import { initSpiralGalaxy } from "./raw/spiralGalaxy";

export const SpiralGalaxy: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initSpiralGalaxy(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
}; 