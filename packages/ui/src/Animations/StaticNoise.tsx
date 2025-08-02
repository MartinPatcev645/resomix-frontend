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
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    /* --------------------------- 3. draw noise ----------------------------- */
    const drawNoise = () => {
      const { width, height } = canvas;
      const imageData = ctx.createImageData(width, height);
      const buffer32 = new Uint32Array(imageData.data.buffer);
      const len = buffer32.length;
      // Alpha range: 0–205 (≈ 0–80 % opacity)
      for (let i = 0; i < len; i++) buffer32[i] = (Math.random() * 205) << 24;
      ctx.putImageData(imageData, 0, 0);
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
      ro.disconnect();
      container.removeChild(canvas);
    };
  }, [color]);

  /* --------------------------- wrapper element --------------------------- */
  return (
    <div
      ref={boxRef}
      className={"pointer-events-none fixed inset-0 " + className}
      style={{
        width: "100%",
        height: "100%",
        opacity,
        zIndex,
      }}
      aria-hidden="true"
    />
  );
};
