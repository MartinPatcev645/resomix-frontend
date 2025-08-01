import { useEffect, useRef } from "react";
import { initRemains } from "./raw/remains";

/**
 * React component wrapper around the Remains WebGL2 shader.
 */
export const Remains: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initRemains(boxRef.current);
    return dispose;
  }, []);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
}; 