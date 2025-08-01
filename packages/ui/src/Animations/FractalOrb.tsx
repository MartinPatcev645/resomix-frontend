import { useEffect, useRef } from "react";
import { initFractalOrb } from "./raw/fractalOrb";

export const FractalOrb: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initFractalOrb(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};