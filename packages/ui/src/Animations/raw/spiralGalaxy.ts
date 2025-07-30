export function initSpiralGalaxy(container: HTMLElement): () => void {
  // Canvas setup bound to container size
  const size = Math.min(container.clientWidth || 180, container.clientHeight || 180);
  const CANVAS_WIDTH = size;
  const CANVAS_HEIGHT = size;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const MONOCHROME_FILL = (opacity: number) =>
    `rgba(255, 255, 255, ${Math.max(0, Math.min(1, opacity))})`;

  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  let time = 0;
  let lastTime = 0;

  // Configuration copied from original JS
  const scale = size / 90; // original design size
  const dotRings = [
    { radius: 15 * scale, count: 6 },
    { radius: 30 * scale, count: 12 },
    { radius: 45 * scale, count: 18 },
    { radius: 60 * scale, count: 24 },
    { radius: 75 * scale, count: 30 },
  ];

  let rafId = 0;
  const animate = (timestamp: number) => {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    time += deltaTime * 0.001; // convert to seconds

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Center dot
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fillStyle = MONOCHROME_FILL(0.9);
    ctx.fill();

    dotRings.forEach((ring, ringIndex) => {
      const ringRotationSpeed = 0.2 + ringIndex * 0.03;
      for (let i = 0; i < ring.count; i++) {
        const baseAngle = (i / ring.count) * Math.PI * 2;
        const spiralArmOffset = (ring.radius / 15) * 0.4;
        const angle = baseAngle + time * ringRotationSpeed + spiralArmOffset;

        const pulseAmplitude = 3;
        const pulseSpeed = 1.5;
        const pulsePhase =
          time * pulseSpeed - ring.radius / 20 + (i / ring.count) * Math.PI;
        const radiusPulse = Math.sin(pulsePhase) * pulseAmplitude;
        const currentRadius = ring.radius + radiusPulse;

        const x = centerX + Math.cos(angle) * currentRadius;
        const y = centerY + Math.sin(angle) * currentRadius;

        const opacityWave = 0.3 + ((Math.sin(pulsePhase - Math.PI / 4) + 1) / 2) * 0.7;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = MONOCHROME_FILL(opacityWave);
        ctx.fill();
      }
    });

    rafId = requestAnimationFrame(animate);
  };

  rafId = requestAnimationFrame(animate);

  // disposer
  return () => {
    cancelAnimationFrame(rafId);
    if (container.contains(canvas)) {
      container.removeChild(canvas);
    }
  };
}
