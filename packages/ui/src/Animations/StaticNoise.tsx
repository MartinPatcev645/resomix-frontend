import { useEffect, useRef } from "react";

export interface StaticNoiseProps {
  /** Background colour on which the noise canvas sits (e.g. "#313132"). */
  color?: string;
  /** Opacity of the whole noise layer (0-1). */
  opacity?: number;
  /** z-index applied to the wrapper element. */
  zIndex?: number;
  /** Extra Tailwind / CSS classes applied to the wrapper. */
  className?: string;
  /** Extra vertical coverage outside the viewport, in viewport-height units (vh). Useful to prevent flashes during rapid scroll. For example, 25 means the noise layer starts 25 vh above the viewport and extends 25 vh below it. Defaults to 0. */
  overscanVh?: number;
  /** Scale factor for pixel size; 1 keeps current density. */
  pixel_dot_ratio?: number;
  /** Whether to use pixelated image rendering. */
  pixelated?: boolean;
}

/**
 * Canvas-based “TV static” overlay.
 * By default it stretches to 100×100 % of its parent. Control placement (absolute / fixed …)
 * through the `className` prop just like any other element.
 */
export const StaticNoise: React.FC<StaticNoiseProps> = ({
  color = "#313132",
  opacity = 1,
  zIndex,
  className = "",
  overscanVh = 0,
  pixel_dot_ratio = 2,
  pixelated = false,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    /* --------------------------- 1. canvas setup --------------------------- */
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const style = canvas.style as CSSStyleDeclaration;
    style.width = "100%";
    style.height = "100%";
    style.display = "block"; // avoid inline-block gaps
    style.pointerEvents = "none";
    style.background = color;

    container.appendChild(canvas);

    /* --------------------------- 2. resize helper -------------------------- */
    // Draw at a fixed design-space resolution (1280×800) and let CSS scale
    // it to fit the container. This keeps the noise density constant and
    // caps the per-frame cost no matter how large the viewport becomes.
    const scale = Math.max(1, pixel_dot_ratio);
    canvas.width = Math.max(1, Math.round(1280 / scale));
    canvas.height = Math.max(1, Math.round(800 / scale));
    // Optional: preserve crisp pixels when the bitmap is enlarged
    if (pixelated) {
      (canvas.style as CSSStyleDeclaration).imageRendering = "pixelated";
    }

    /* --------------------------- 3. precompute frames ---------------------- */
    const FRAME_COUNT = 20;
    const frames: ImageData[] = [];
    {
      const { width, height } = canvas;
      if (width > 0 && height > 0) {
        for (let f = 0; f < FRAME_COUNT; f++) {
          const imageData = ctx.createImageData(width, height);
          const buffer32 = new Uint32Array(imageData.data.buffer);
          const len = buffer32.length;
          for (let i = 0; i < len; i++) buffer32[i] = (Math.random() * 220) << 24;
          frames.push(imageData);
        }
      }
    }

    /* --------------------------- 4. draw noise ----------------------------- */
    let frameIndex = 0;
    const drawNoise = () => {
      if (frames.length === 0) return;
      ctx.putImageData(frames[frameIndex], 0, 0);
      frameIndex = (frameIndex + 1) % frames.length;
    };

    /* --------------------------- 4. animation loop ------------------------- */
    let toggle = true;
    const loop = () => {
      toggle = !toggle;
      if (toggle) {
        requestAnimationFrame(loop);
        return;
      }
      drawNoise();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    /* --------------------------- 5. cleanup -------------------------------- */
    return () => {
      container.removeChild(canvas);
    };
  }, [color, pixel_dot_ratio]);

  /* --------------------------- wrapper element --------------------------- */
  const extra = overscanVh > 0 ? `${overscanVh}vh` : "0";

  return (
    <div
      ref={boxRef}
      className={"pointer-events-none fixed left-0 right-0 " + className}
      style={{
        top: `-${extra}`,
        width: "100%",
        height: `calc(100vh + ${overscanVh * 2}vh)`,
        opacity,
        zIndex,
      }}
      aria-hidden="true"
    />
  );
};
