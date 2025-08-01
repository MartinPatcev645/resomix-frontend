import { useEffect, useRef } from "react";
import { initRockRing } from "./raw/rockRing";

/**
 * React wrapper around the raw Three.js implementation found in
 * `./raw/rockRing.ts`. It only handles the mounting / un-mounting lifecycle and
 * exposes no additional props for now (feel free to extend 💪).
 */
export const RockRing: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initRockRing(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
}; 
