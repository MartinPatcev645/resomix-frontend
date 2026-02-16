import { useEffect, useRef, useState } from "react";

export interface StaticNoiseProps {
  /** Optional Tailwind/utility classes. Defaults to a fullscreen fixed overlay. */
  className?: string;
  /** Optional z-index so you can position above/below other layers. */
  zIndex?: number;
  /** Target frames-per-second for the render loop. Defaults to 60. */
  fps?: number;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLSL Shaders — Seagull Nebula (IC 2177) Representation
   Deep red/pink emission nebula with a distinct "bird" shape against a dense starfield.
   ═══════════════════════════════════════════════════════════════════════════ */

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform float u_seed;

// ── UTILS ───────────────────────────────────────────────────────────────────

highp float hash(highp vec2 p) {
  highp vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// 2D Rotation matrix
mat2 rotate(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += amp * noise(p);
    p = rot * p * 2.0 + vec2(1.2, 3.4);
    amp *= 0.5;
  }
  return v;
}

// ── SHOOTING STAR ───────────────────────────────────────────────────────────

float shootingStar(vec2 uv, float t, float interval, float slot) {
  // Randomize timing per slot
  float timeOffset = hash(vec2(slot, 12.34)) * 100.0;
  float adjustedTime = t + timeOffset;
  
  float cycle = floor(adjustedTime / interval);
  float local = adjustedTime - cycle * interval;
  
  float duration = 1.2; // How long it stays on screen
  if (local > duration) return 0.0;
  
  float progress = local / duration;
  
  // Randomize characteristics based on cycle
  float r1 = hash(vec2(cycle + slot, slot + 7.0));
  float r2 = hash(vec2(cycle + slot, slot + 13.0));
  float r3 = hash(vec2(cycle + slot, slot + 23.0));
  
  // Start position (randomized)
  vec2 origin = vec2(mix(-0.8, 0.8, r1), mix(-0.2, 0.8, r2));
  
  // Angle (Left-down diagonal to match nebula flow mostly, or random)
  float angle = mix(-0.5, -2.5, r3); 
  vec2 dir = vec2(cos(angle), sin(angle));
  
  float speed = 0.8 + 0.5 * r2;
  vec2 head = origin + dir * progress * speed;
  float trailLen = 0.15 + 0.1 * r1;
  vec2 tail = head - dir * trailLen;
  
  // Distance to line segment
  vec2 pa = uv - tail;
  vec2 ba = head - tail;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  
  // Sharp thin line
  float streak = smoothstep(0.002, 0.0005, d);
  streak *= h; // Fade tail
  streak *= smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.5, progress); // Fade in/out
  
  return streak;
}

// ── STARFIELD ───────────────────────────────────────────────────────────────

vec3 starLayer(vec2 uv, float density, float seed) {
  vec2 id = floor(uv * density);
  vec2 gv = fract(uv * density) - 0.5;
  
  float rnd = hash(id + seed * 0.001);
  
  // REDUCED DENSITY: Only top 4.5% of slots have a star (was ~15%)
  // Original threshold was < 0.85 (15%). New: < 0.955 (4.5%) -> 70% reduction
  if (rnd < 0.955) return vec3(0.0); 
  
  // RANDOM SIZE: Max size reduced
  // Previously: 0.02 + 0.1 * hash... => Max ~0.12
  // New: 0.02 + 0.035 * hash... => Max ~0.055 (approx 1/3 of previous max visual weight)
  float sizeBase = 0.02 + 0.035 * hash(id * 9.2); 
  
  // BLINKING: Slower, desynchronized
  // Use a very large multiplier for rnd (100.0) to desync phases completely
  // Slower rate: u_time multiplied by smaller factor (0.5 to 1.5)
  float blinkSpeed = 0.5 + 1.0 * rnd; 
  float blinkPhase = rnd * 100.0;
  float brightness = 0.5 + 0.5 * sin(u_time * blinkSpeed + blinkPhase);
 
  // Position jitter
  vec2 offset = (vec2(hash(id), hash(id + 11.0)) - 0.5) * 0.8;
  float d = length(gv - offset);
  
  // SHARP STAR: No outer glow, sharp smoothstep
  float core = smoothstep(sizeBase, sizeBase - 0.01, d);
  
  return vec3(core * brightness); // Pure white
}

// ── NEBULA SDF / SHAPE ──────────────────────────────────────────────────────

// Domain warping for the "Seagull" shape
float seagullShape(vec2 p) {
  // Rotate to align diagonal (Top-Right to Bottom-Left)
  p = rotate(0.4) * p; // Slight tilt
  
  // Head (Center-ish, slightly offset)
  vec2 headPos = p - vec2(-0.2, 0.1);
  float head = smoothstep(0.4, 0.0, length(headPos)) * 1.5;
  
  // Wings (Arc shape)
  // Use a curve function: y = x^2 approx
  float wingArc = abs(p.y - 0.3 * sin(p.x * 2.0)); 
  float wings = smoothstep(0.5, 0.0, wingArc) * smoothstep(1.2, 0.0, abs(p.x));
  
  // Combine
  return head * 0.8 + wings * 0.6;
}

void main() {
  // Normalize UV
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / min(u_res.y, u_res.x); 
  
  // Slow global movement for everything
  float time = u_time * 0.05;
  
  // ── MOVEMENT CONSTANTS ────────────────────────────────────────────────────
  // Slowly rotating and panning the view
  float globalRot = sin(time * 0.1) * 0.05; // Subtle back-forth rotation
  mat2 viewRot = rotate(globalRot);
  vec2 pan = vec2(time * 0.05, time * 0.02); // Slow drift
  
  // ── BACKGROUND ────────────────────────────────────────────────────────────
  vec3 bg = vec3(0.005, 0.005, 0.01); // Deep dark space, slight blue tint
  
  // ── STARS ─────────────────────────────────────────────────────────────────
  // Parallax layers moving at different speeds/rotations
  vec3 stars = vec3(0.0);
  
  // Distant small stars (slowest)
  vec2 uvStar1 = viewRot * uv + pan * 0.2;
  stars += starLayer(uvStar1, 80.0, u_seed);
  
  // Mid stars
  vec2 uvStar2 = viewRot * uv + pan * 0.5 + vec2(0.5); // Offset
  stars += starLayer(uvStar2, 40.0, u_seed + 12.0);
  
  // Bright foreground stars (fastest, feels closer)
  vec2 uvStar3 = viewRot * uv + pan * 1.0 + vec2(0.2, 0.8);
  stars += starLayer(uvStar3, 15.0, u_seed + 55.0);
  
  // ── NEBULA (Seagull Composition) ──────────────────────────────────────────
  
  // Nebula movement: rotate lightly and pan
  vec2 nebulaUV = viewRot * uv + pan * 0.1; // Nebula is "far", moves slow
  
  // Global coordinate distortion for wispy feel
  // We offset the FBM with time to make the "smoke" evolve slightly
  vec2 nUV = nebulaUV * 1.0;
  float warp = fbm(nUV * 3.0 + vec2(time * 0.15, 0.0));
  nUV += warp * 0.2;
  
  // Shape mask (using the moving UV)
  float mask = seagullShape(nebulaUV * 0.8); 
  
  // Detail layers within the shape
  float detail1 = fbm(nUV * 4.0 + vec2(time * 0.2, -time * 0.1));
  float detail2 = fbm(nUV * 8.0 - vec2(time * 0.1, time * 0.1));
  
  // Dust lanes (darker subtraction)
  float dust = fbm(nebulaUV * 6.0 + warp + vec2(10.0));
  
  // Composition
  float cloud = mask * (detail1 * 0.7 + detail2 * 0.3);
  cloud = smoothstep(0.1, 1.0, cloud); // Contrast
  
  // Carve out dust
  cloud *= smoothstep(0.35, 1.0, 1.0 - dust * 0.8);
  
  // Color Palette
  // Deep reds, pinks, magenta, faint orange
  vec3 colDeepRed = vec3(0.2, 0.0, 0.05);
  vec3 colPink = vec3(0.8, 0.1, 0.3);
  vec3 colOrange = vec3(1.0, 0.4, 0.1);
  vec3 colMagenta = vec3(0.6, 0.1, 0.4);
  
  vec3 nebulaCol = mix(colDeepRed, colPink, detail1);
  nebulaCol = mix(nebulaCol, colOrange, detail2 * mask); // Highlights
  nebulaCol = mix(nebulaCol, colMagenta, dust * 0.5); // Accents
  
  // Additive Blend
  vec3 finalCloud = nebulaCol * cloud * 2.5; // Boost intensity
  
  // ── SHOOTING STARS ────────────────────────────────────────────────────────
  // Random interval 5-8 seconds
  // We use multiple slots to allow overlap if needed, though rare
  float shoot = 0.0;
  // Interval 7.0s avg
  shoot += shootingStar(uv, u_time, 7.0, 10.0); // Slot 1
  shoot += shootingStar(uv, u_time, 6.2, 25.0); // Slot 2 (diff freq for variance)
  
  // ── COMPOSITE ─────────────────────────────────────────────────────────────
  
  // Vignette
  float vig = 1.0 - dot(uv, uv) * 0.4;
  
  vec3 finalColor = bg + stars + finalCloud + vec3(shoot);
  finalColor *= vig;
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   WebGL helpers
   ═══════════════════════════════════════════════════════════════════════════ */

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function buildProgram(
  gl: WebGLRenderingContext,
  vSrc: string,
  fSrc: string,
): WebGLProgram | null {
  const v = compileShader(gl, gl.VERTEX_SHADER, vSrc);
  const f = compileShader(gl, gl.FRAGMENT_SHADER, fSrc);
  if (!v || !f) return null;
  const p = gl.createProgram()!;
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  gl.detachShader(p, v);
  gl.detachShader(p, f);
  gl.deleteShader(v);
  gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

/* ═══════════════════════════════════════════════════════════════════════════
   React component
   ═══════════════════════════════════════════════════════════════════════════ */

export const StaticNoise: React.FC<StaticNoiseProps> = ({
  className = "pointer-events-none fixed inset-0",
  zIndex,
  fps = 60,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  /* ── WebGL lifecycle ─────────────────────────────────────────────────── */
  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    // --- Canvas / GL context ------------------------------------------------
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.background = "#050508"; // Fallback deep space color
    container.appendChild(canvas);

    const opts: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "default",
    };
    const gl =
      canvas.getContext("webgl2", opts) ||
      (canvas.getContext("webgl", opts) as WebGLRenderingContext | null);
    if (!gl) return;

    const pgm = buildProgram(gl, VERT, FRAG);
    if (!pgm) return;
    gl.useProgram(pgm);

    // --- Geometry (fullscreen quad) -----------------------------------------
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(pgm, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // --- Uniforms -----------------------------------------------------------
    const uRes = gl.getUniformLocation(pgm, "u_res");
    const uTime = gl.getUniformLocation(pgm, "u_time");
    const uSeed = gl.getUniformLocation(pgm, "u_seed");
    gl.uniform1f(uSeed, Math.random() * 10000);

    // --- Resize handling ----------------------------------------------------
    const prevSize = { w: 0, h: 0 };

    const resize = (force = false) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // Max DPR 2 for performance
      const currentW = Math.max(1, Math.floor(container.clientWidth * dpr));
      const currentH = Math.max(1, Math.floor(container.clientHeight * dpr));

      const widthIncreased = currentW > prevSize.w;
      const heightIncreased = currentH > prevSize.h;
      // Reallocate if size changes significantly or increases
      const shouldUpdate =
        force ||
        widthIncreased ||
        heightIncreased ||
        Math.abs(currentW - prevSize.w) > 50 ||
        Math.abs(currentH - prevSize.h) > 50;

      if (shouldUpdate) {
        canvas.width = currentW;
        canvas.height = currentH;
        prevSize.w = currentW;
        prevSize.h = currentH;
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.uniform2f(uRes, currentW, currentH);
      }
    };

    const ro = new ResizeObserver(() => resize(false));
    ro.observe(container);
    resize(true);

    // --- Render loop --------------------------------------------------------
    let raf = 0;
    let last = 0;
    const interval = 1000 / Math.max(1, fps);
    const t0 = performance.now();

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - last < interval) return;
      last = now;

      resize();
      gl.uniform1f(uTime, (now - t0) * 0.001);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const start = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => {
      if (document.hidden) {
        stop();
      } else {
        last = 0;
        start();
      }
    };

    document.addEventListener("visibilitychange", onVis);
    start();

    // --- Cleanup ------------------------------------------------------------
    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);

      gl.deleteProgram(pgm);
      gl.deleteBuffer(buf);

      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();

      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [fps]);

  return (
    <div
      ref={boxRef}
      className={className}
      style={{ zIndex }}
      aria-hidden="true"
    />
  );
};

export default StaticNoise;