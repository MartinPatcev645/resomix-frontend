export function initCrystallineCube(container: HTMLElement): () => void {
  // Basic canvas setup constants – keep identical to original demo to preserve look
  const CANVAS_WIDTH = 180;
  const CANVAS_HEIGHT = 180;

  // Utility helpers copied from original snippet
  const MONOCHROME_FILL = (opacity: number) =>
    `rgba(255, 255, 255, ${Math.max(0, Math.min(1, opacity))})`;

  // Cubic easing (ease-in-out) used throughout the animation
  const easeInOutCubic = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Global speed multiplier (1 == original, lower == slower)
  const GLOBAL_SPEED = 0.5;

  // ---------------------------------------------------------------------------
  // Canvas creation – appended directly to provided container
  // ---------------------------------------------------------------------------
  container.innerHTML = ""; // purge previous content if any
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // ---------------------------------------------------------------------------
  // Pre-compute static point cloud representing the cube
  // ---------------------------------------------------------------------------
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const gridSize = 7;
  const spacing = 15;
  const cubeHalfSize = ((gridSize - 1) * spacing) / 2;
  const maxDist = Math.hypot(cubeHalfSize, cubeHalfSize, cubeHalfSize);
  const points: { x: number; y: number; z: number }[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        points.push({
          x: x * spacing - cubeHalfSize,
          y: y * spacing - cubeHalfSize,
          z: z * spacing - cubeHalfSize,
        });
      }
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
    time += deltaTime * 0.0003 * GLOBAL_SPEED;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Rotation parameters
    const rotX = time * 2;
    const rotY = time * 3;

    // Expanding spherical wave parameters
    const waveRadius = (timestamp * 0.04 * GLOBAL_SPEED) % (maxDist * 1.5);
    const waveWidth = 40;
    const displacementMagnitude = 10;

    // Prepare an array for depth-sorted drawing
    const pointsToDraw: { x: number; y: number; z: number; size: number; opacity: number }[] = [];

    points.forEach((pOrig) => {
      let { x, y, z } = pOrig;

      // Compute distance from center for wave effect
      const distFromCenter = Math.hypot(x, y, z);
      const distToWave = Math.abs(distFromCenter - waveRadius);
      let displacementAmount = 0;
      if (distToWave < waveWidth / 2) {
        const wavePhase = (distToWave / (waveWidth / 2)) * (Math.PI / 2);
        displacementAmount = easeInOutCubic(Math.cos(wavePhase)) * displacementMagnitude;
      }

      // Radial displacement due to wave
      if (displacementAmount > 0 && distFromCenter > 0) {
        const ratio = (distFromCenter + displacementAmount) / distFromCenter;
        x *= ratio;
        y *= ratio;
        z *= ratio;
      }

      // --- Rotate around Y (rotY) then X (rotX) ---
      const cY = Math.cos(rotY);
      const sY = Math.sin(rotY);
      let tX = x * cY - z * sY;
      let tZ = x * sY + z * cY;
      x = tX;
      z = tZ;

      const cX = Math.cos(rotX);
      const sX = Math.sin(rotX);
      let tY = y * cX - z * sX;
      tZ = y * sX + z * cX;
      y = tY;
      z = tZ;

      // Perspective projection
      const fov = 250;
      const scale = fov / (fov + z);
      const pX = centerX + x * scale;
      const pY = centerY + y * scale;

      // Visuals – dot size & opacity influenced by wave displacement
      const waveInfluence = displacementAmount / displacementMagnitude;
      const size = (1.5 + waveInfluence * 2.5) * scale;
      const opacity = Math.max(0.1, scale * 0.7 + waveInfluence * 0.4);

      if (size > 0.1) {
        pointsToDraw.push({ x: pX, y: pY, z, size, opacity });
      }
    });

    // Painter's algorithm – draw from farthest to nearest (smallest z first)
    pointsToDraw.sort((a, b) => a.z - b.z).forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = MONOCHROME_FILL(p.opacity);
      ctx.fill();
    });

    frameId = requestAnimationFrame(animate);
  };

  frameId = requestAnimationFrame(animate);

  // ---------------------------------------------------------------------------
  // Disposal – cancel the RAF loop and remove canvas from DOM
  // ---------------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(frameId);
    if (container.contains(canvas)) {
      container.removeChild(canvas);
    }
  };
}
