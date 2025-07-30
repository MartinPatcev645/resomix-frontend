import { useEffect, useRef } from "react";
import { initStarfield } from "./raw/starfield";  // adjust path as needed

export const FlyingThroughSpace: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initStarfield(boxRef.current); // mount effect
    return dispose;                                // clean‑up on unmount
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
