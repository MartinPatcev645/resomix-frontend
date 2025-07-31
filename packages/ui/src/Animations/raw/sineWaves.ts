export function initSineWaves(container: HTMLElement): () => void {
  // ---------------------------------------------------------------------
  // Canvas setup tied to the container
  // ---------------------------------------------------------------------
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  if (!ctx) {
    // Fail silently – nothing to dispose
    return () => {};
  }

  container.appendChild(canvas);

  // Device pixel ratio handling (retina, etc.)
  let dpr = window.devicePixelRatio || 1;

  // Animation configuration ------------------------------------------------
  interface WaveOptions {
    timeModifier: number;
    lineWidth: number;
    amplitude: number;
    wavelength: number;
    segmentLength?: number;
    strokeStyle?: string | CanvasGradient;
  }

  const waves: WaveOptions[] = [
    {
      timeModifier: 0.5, // slower, long wavelength
      lineWidth: 3,
      amplitude: 150,
      wavelength: 200,
      segmentLength: 20,
      // strokeStyle applied in resize handler
    },
    {
      timeModifier: 1, // baseline
      lineWidth: 2,
      amplitude: 150,
      wavelength: 100,
      segmentLength: 20,
    },
    {
      timeModifier: 1, // faster, tighter wave
      lineWidth: 1,
      amplitude: -150,
      wavelength: 100,
      segmentLength: 20,
    },
    {
      timeModifier: 3, // fastest, very tight
      lineWidth: 0.5,
      amplitude: -100,
      wavelength: 50,
      segmentLength: 5,
    },
  ];

  // Default settings -------------------------------------------------------
  const speed = 8;
  let time = 0;

  // Sizing -----------------------------------------------------------------
  function resizeCanvas() {
    const { width: displayWidth, height: displayHeight } = container.getBoundingClientRect();
    if (!displayWidth || !displayHeight) return;

    dpr = window.devicePixelRatio || 1;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;

    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Update gradient stroke styles so they always span full width
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    waves.forEach((w) => {
      w.strokeStyle = gradient;
    });
  }

  // Draw helpers -----------------------------------------------------------
  const PI2 = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  function ease(percent: number, amplitude: number) {
    return amplitude * (Math.sin(percent * PI2 - HALF_PI) + 1) * 0.5;
  }

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawSine(localTime: number, opts: WaveOptions) {
    // Scale amplitude relative to canvas height so the wave always fits.
    // The original demo expected ~600px tall canvas when amplitude values were tuned.
    // We normalize by assuming that 600px height corresponds to amplitude=opts.amplitude
    // and scale linearly.
    const amplitude = opts.amplitude * (canvas.height / (600 * dpr));
    const wavelength = opts.wavelength;
    const lineWidth = opts.lineWidth;
    const strokeStyle = opts.strokeStyle || "rgba(255, 255, 255, 0.2)";
    const segmentLength = opts.segmentLength ?? 10;

    const yAxis = canvas.height / 2; // center vertically

    ctx.lineWidth = lineWidth * dpr;
    ctx.strokeStyle = strokeStyle;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    // Starting line – slight left padding
    const waveLeft = canvas.width * 0.025;
    const waveWidth = canvas.width * 0.95;

    ctx.moveTo(0, yAxis);
    ctx.lineTo(waveLeft, yAxis);

    for (let i = 0; i < waveWidth; i += segmentLength) {
      const x = localTime * speed + (-yAxis + i) / wavelength;
      const y = Math.sin(x);
      const amp = ease(i / waveWidth, amplitude);
      ctx.lineTo(i + waveLeft, amp * y + yAxis);
    }

    // Ending line
    ctx.lineTo(canvas.width, yAxis);
    ctx.stroke();
  }

  function update() {
    // Slowly advance time
    time -= 0.007;

    // Draw every wave with its own modifier
    waves.forEach((wave) => {
      const t = time * (wave.timeModifier || 1);
      drawSine(t, wave);
    });
  }

  // Animation loop ---------------------------------------------------------
  let rafId: number;
  function loop() {
    clear();
    update();
    rafId = requestAnimationFrame(loop);
  }

  // Kick things off --------------------------------------------------------
  resizeCanvas();
  loop();

  // Listen for resizes
  window.addEventListener("resize", resizeCanvas);

  // ---------------------------------------------------------------------
  // Disposer – remove canvas, cancel animation frame & listeners
  // ---------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resizeCanvas);
    if (container.contains(canvas)) {
      container.removeChild(canvas);
    }
  };
} 