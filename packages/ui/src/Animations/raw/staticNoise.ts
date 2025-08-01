import ResizeObserver from "resize-observer-polyfill";

export interface StaticNoiseOptions {
  /** How many times per second the noise pattern should change. If 0 or negative, it will animate every animation frame. */
  fps: number;
  /** Background color applied to the canvas element (e.g. "#323233"). */
  canvasBg: string;
}

const DEFAULTS: StaticNoiseOptions = {
  fps: 30,
  canvasBg: "transparent",
};

/**
 * Bootstraps a static noise Canvas animation, similar to an old TV static.
 * Accepts `color` (noise tint) and `fps` (frames-per-second update rate) options.
 * Returns a disposer you MUST call on unmount.
 */
export function initStaticNoise(
  container: HTMLElement,
  options: Partial<StaticNoiseOptions> = {}
): () => void {
  const opts: StaticNoiseOptions = { ...DEFAULTS, ...options };

  /* ------------------------------------------------------------
   * 1. canvas bound to the container (not <body>)
   * ---------------------------------------------------------- */
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block"; // tailwind resets inherit
  canvas.style.background = opts.canvasBg;
  canvas.style.pointerEvents = "none"; // purely decorative
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // If 2D context is not available, bail early (should never happen in modern browsers)
    // eslint-disable-next-line no-console
    console.error("initStaticNoise: 2D canvas context not available");
    return () => {
      container.removeChild(canvas);
    };
  }

  /* ------------------------------------------------------------
   * 2. helpers for resize and drawing
   * ---------------------------------------------------------- */
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const drawNoise = () => {
    const { width, height } = canvas;
    const imageData = ctx.createImageData(width, height);
    const buffer32 = new Uint32Array(imageData.data.buffer);
    const len = buffer32.length;
    for (let i = 0; i < len; i++) {
      buffer32[i] = (Math.random() * 255) << 24; // random alpha, black RGB -> matches original effect
    }
    ctx.putImageData(imageData, 0, 0);
  };

  /* ------------------------------------------------------------
   * 3. animation loop (either RAF or fixed FPS)
   * ---------------------------------------------------------- */
  let rafId = 0;
  let toggle = false;
  const msPerFrame = 1000 / opts.fps;
  let lastTime = 0;

  const loop = (time: number) => {
    rafId = requestAnimationFrame(loop);
    if (time - lastTime < msPerFrame) return; // throttle to fps
    lastTime = time;
    // emulate original toggle logic (draw every other frame)
    toggle = !toggle;
    if (!toggle) return;
    drawNoise();
  };
  rafId = requestAnimationFrame(loop);

  /* ------------------------------------------------------------
   * 4. resize observer bound to container
   * ---------------------------------------------------------- */
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  /* ------------------------------------------------------------
   * 5. disposer for React unmount
   * ---------------------------------------------------------- */
  return () => {
    // no interval used now
    cancelAnimationFrame(rafId);
    ro.disconnect();
    container.removeChild(canvas);
  };
} 