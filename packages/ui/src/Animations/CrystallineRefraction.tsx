import { useEffect, useRef } from "react";
import { initCrystallineRefraction } from "./raw/crystallineRefraction";

export const CrystallineRefraction: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initCrystallineRefraction(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
