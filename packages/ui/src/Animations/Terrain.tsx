import { useEffect, useRef } from "react";
import { initTerrain, TerrainOptions } from "./raw/terrain";

export type TerrainProps = Partial<TerrainOptions> & {
  className?: string;
};

/**
 * React wrapper around the Perlin-noise terrain WebGL animation.
 *
 * Example:
 *   <Terrain elevation={2} wireframeColor="#ff00ff" />
 */
export const Terrain: React.FC<TerrainProps> = ({ className = "", ...opts }) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!boxRef.current) return;
    const dispose = initTerrain(boxRef.current, opts);
    return dispose;
  }, [opts]); // re-init if any option object identity changes

  return (
    <div
      ref={boxRef}
      className={
        "relative w-full h-full overflow-hidden pointer-events-none " + className
      }
    />
  );
};
