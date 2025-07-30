import { useEffect, useRef } from "react";
import { initGoldenSpiral } from "./raw/goldenSpiral";

export const GoldenSpiral: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initGoldenSpiral(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
