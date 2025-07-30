export function initCrystallineRefraction(container: HTMLElement): () => void {
  // Canvas size identical to other animations for consistency
  const CANVAS_WIDTH = 180;
  const CANVAS_HEIGHT = 180;

  // Helper to keep white-on-transparent styling with controllable opacity
  const MONOCHROME_FILL = (opacity: number) =>
    `rgba(255, 255, 255, ${Math.max(0, Math.min(1, opacity))})`;

  // Easing for organic motion
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Slow the original demo a bit so it feels calmer in UI
  const GLOBAL_SPEED = 0.5;

  // ---------------------------------------------------------------------------
  // Canvas setup – purge container & create sized canvas
  // ---------------------------------------------------------------------------
  container.innerHTML = "";
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // ---------------------------------------------------------------------------
  // Pre-compute static dot grid
  // ---------------------------------------------------------------------------
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const gridSize = 15;
  const spacing = CANVAS_WIDTH / (gridSize - 1);
  const dots: { x: number; y: number }[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      dots.push({ x: c * spacing, y: r * spacing });
    }
  }

  // ---------------------------------------------------------------------------
  // Animation loop
  // ---------------------------------------------------------------------------
  let time = 0;
  let lastTime = 0;
  let frameId = 0;

  const animate = (timestamp: number) => {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    time += deltaTime * 0.16 * GLOBAL_SPEED;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Radial ripple parameters
    const waveRadius = time % (CANVAS_WIDTH * 1.2);
    const waveWidth = 60;

    dots.forEach((dot) => {
      const dist = Math.hypot(dot.x - centerX, dot.y - centerY);
      const distToWave = Math.abs(dist - waveRadius);
      let displacement = 0;
      if (distToWave < waveWidth / 2) {
        const wavePhase = (distToWave / (waveWidth / 2)) * Math.PI;
        displacement = easeInOutCubic(Math.sin(wavePhase)) * 10; // push outward
      }

      // Apply displacement along radial direction
      const angleToCenter = Math.atan2(dot.y - centerY, dot.x - centerX);
      const dx = Math.cos(angleToCenter) * displacement;
      const dy = Math.sin(angleToCenter) * displacement;

      // Size / opacity scale with displacement magnitude
      const opacity = 0.2 + (Math.abs(displacement) / 10) * 0.8;
      const size = 1.2 + (Math.abs(displacement) / 10) * 2;

      ctx.beginPath();
      ctx.arc(dot.x + dx, dot.y + dy, size, 0, Math.PI * 2);
      ctx.fillStyle = MONOCHROME_FILL(opacity);
      ctx.fill();
    });

    frameId = requestAnimationFrame(animate);
  };

  frameId = requestAnimationFrame(animate);

  // ---------------------------------------------------------------------------
  // Disposal – cancel RAF & clean DOM
  // ---------------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(frameId);
    if (container.contains(canvas)) {
      container.removeChild(canvas);
    }
  };
}
