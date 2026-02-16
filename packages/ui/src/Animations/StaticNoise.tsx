import { useEffect, useRef, useState } from "react";

export interface StaticNoiseProps {
  /** Optional Tailwind/utility classes. Defaults to a fullscreen fixed overlay. */
  className?: string;
  /** Optional z-index so you can position above/below other layers. */
  zIndex?: number;
  /** Target frames-per-second for the render loop. Defaults to 60. */
  fps?: number;
  /** Speed of the starfield movement (spaceship effect). Defaults to 1.0. */
  speed?: number;
  /** Speed of the nebula's internal evolution/rotation. Defaults to 1.5. */
  nebulaSpeed?: number;
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
uniform float u_speed;        // Starfield "travel" speed
uniform float u_nebula_speed; // Nebula evolution/rotation speed

// ── UTILS ───────────────────────────────────────────────────────────────────

highp float hash(highp vec2 p) {
  highp vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 3D Noise for smoother temporal transitions if needed, but 2D is fine for blinking
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
  float timeOffset = hash(vec2(slot, 12.34)) * 100.0;
  float adjustedTime = t + timeOffset;
  
  float cycle = floor(adjustedTime / interval);
  float local = adjustedTime - cycle * interval;
  
  float duration = 1.2; 
  if (local > duration) return 0.0;
  
  float progress = local / duration;
  
  float r1 = hash(vec2(cycle + slot, slot + 7.0));
  float r2 = hash(vec2(cycle + slot, slot + 13.0));
  float r3 = hash(vec2(cycle + slot, slot + 23.0));
  
  vec2 origin = vec2(mix(-0.8, 0.8, r1), mix(-0.2, 0.8, r2));
  float angle = mix(-0.5, -2.5, r3); 
  vec2 dir = vec2(cos(angle), sin(angle));
  
  float speed = 0.8 + 0.5 * r2;
  vec2 head = origin + dir * progress * speed;
  float trailLen = 0.15 + 0.1 * r1;
  vec2 tail = head - dir * trailLen;
  
  vec2 pa = uv - tail;
  vec2 ba = head - tail;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  
  float streak = smoothstep(0.002, 0.0005, d);
  streak *= h; 
  streak *= smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.5, progress); 
  
  return streak;
}

// ── STARFIELD ───────────────────────────────────────────────────────────────

vec3 starLayer(vec2 uv, float density, float seed, vec3 tint) {
  vec2 id = floor(uv * density);
  vec2 gv = fract(uv * density) - 0.5;
  
  float rnd = hash(id + seed * 0.001);
  
  // REDUCED DENSITY 2 (50% less than previous step)
  // Previous threshold: < 0.955 (~4.5% fill)
  // New target: ~2.25% fill -> Threshold < 0.9775
  if (rnd < 0.9775) return vec3(0.0); 
  
  // REDUCED SIZE 2 (50% smaller max)
  float sizeBase = 0.01 + 0.0175 * hash(id * 9.2); 
  
  // SMOOTH BLINKING
  float blinkSpeed = 0.2 + 0.5 * rnd; 
  float blinkPhase = rnd * 50.0;
  
  float brightness = 0.7 + 0.3 * sin(u_time * blinkSpeed + blinkPhase);
 
  vec2 offset = (vec2(hash(id), hash(id + 11.0)) - 0.5) * 0.8;
  float d = length(gv - offset);
  
  // Sharp star
  float core = smoothstep(sizeBase, sizeBase - 0.005, d);
  
  return tint * core * brightness; 
}

// ── NEBULA SDF / SHAPE ──────────────────────────────────────────────────────

// Now accepts time for dynamic shaping
float seagullShape(vec2 p, float t) {
  p = rotate(0.4) * p; 
  vec2 headPos = p - vec2(-0.2, 0.1);
  float head = smoothstep(0.4, 0.0, length(headPos)) * 1.5;
  
  // Dynamic wing properties
  // "Change shape... more wide or long and dim... bright while narrow"
  // Period ~10s
  float shapeCycle = sin(t * 0.5); 
  
  // Amplitude (width): Base 0.3 +/- 0.1
  float amplitude = 0.3 + shapeCycle * 0.1; 
  // Length (x-spread): Base 1.2 +/- 0.3
  // When wide (amplitude high), length should ideally change too?
  float lengthFactor = 1.2 - shapeCycle * 0.3; 
  
  float wingArc = abs(p.y - amplitude * sin(p.x * 2.0)); 
  float wings = smoothstep(0.5, 0.0, wingArc) * smoothstep(lengthFactor, 0.0, abs(p.x));
  
  return head * 0.8 + wings * 0.6;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / min(u_res.y, u_res.x); 
  
  // ── MOVEMENT: ROTATION CLOCKWISE ──────────────────────────────────────────
  // User wants "stars to go around... clockwise... very close to a circle"
  // "Rotating spaceship feel"
  
  // Center of rotation can be center of screen (0,0 in UV space)
  // To rotate stars CLOCKWISE, we rotate UVs ANTI-CLOCKWISE? 
  // If camera rotates CW, world rotates CCW.
  // Wait, if I spin CW, the room spins CCW relative to my view.
  // User said "stars go around... clockwise".
  // So we rotate UVs in negative direction (CW)? 
  // Standard rotation matrix: +angle is CCW. -angle is CW.
  
  float rotSpeed = u_speed * 0.1;
  float angle = u_time * rotSpeed; // Positive angle for Clockwise visual rotation
  mat2 rot = rotate(angle);
  
  // ── BACKGROUND ────────────────────────────────────────────────────────────
  vec3 bg = vec3(0.005, 0.005, 0.01); 
  
  // ── LAYER 1: DISTANT STARS (Rotation Parallax) ────────────────────────────
  vec3 starsBack = vec3(0.0);
  
  // Rotation parallax: distant stars rotate slower? 
  // Actually, purely rotational movement means distant things move same angular speed usually 
  // BUT for "depth" feel, maybe we slighty vary the rotation speed or center?
  // Let's stick to true rotation for now, maybe scale UVs for depth (zoom)
  
  // Layer 1 (Furthest)
  vec2 uvStar1 = rot * uv; 
  starsBack += starLayer(uvStar1, 80.0, u_seed, vec3(1.0));
  
  // Layer 1.5 (Slightly faster rotation or just offset?)
  // Let's create a "spiral" or "very close to circle" effect by adding small drift
  // Drift outward/inward over time? "Not exactly a circle"
  vec2 drift = vec2(sin(u_time * 0.1), cos(u_time * 0.13)) * 0.1;
  vec2 uvStar2 = rot * (uv + drift) + vec2(0.5); 
  starsBack += starLayer(uvStar2, 50.0, u_seed + 12.0, vec3(1.0));

  // ── NEBULA (Dynamic Shape) ────────────────────────────────────────────────
  
  // Nebula stays on screen, but moves/shapes dynamically
  float nebTime = u_time * u_nebula_speed * 0.05;
  
  // Dynamic Intensity/Brightness
  // "dim... or bright"
  // Inverse to width? Wide = Dim, Narrow = Bright
  float shapeCycle = sin(nebTime * 10.0 * 0.5); // Same freq as shape function
  
  float brightnessMod = 1.0 - shapeCycle * 0.4; // 0.6 to 1.4 range approx
  
  // Constrained Movement
  vec2 nebPan = vec2(sin(nebTime * 0.3), cos(nebTime * 0.25)) * 0.15; 
  vec2 nebulaUV = uv + nebPan; // Constrained
  
  // Rotate nebula slowly (independent of ship rotation to show it's "space")
  // Or should it rotate with the stars? Usually background rotates with stars.
  // Let's apply half-rotation to imply distance?
  nebulaUV = rotate(angle * 0.5) * nebulaUV;
  
  vec2 nUV = nebulaUV * 1.0;
  float warp = fbm(nUV * 3.0 + vec2(nebTime * 0.15, 0.0));
  nUV += warp * 0.2;
  
  // Dynamic Shape Call
  float mask = seagullShape(nebulaUV * 0.8, nebTime * 10.0); 
  
  float detail1 = fbm(nUV * 4.0 + vec2(nebTime * 0.3, -nebTime * 0.1));
  float detail2 = fbm(nUV * 8.0 - vec2(nebTime * 0.15, nebTime * 0.2));
  
  float dust = fbm(nebulaUV * 6.0 + warp + vec2(10.0));
  
  float cloud = mask * (detail1 * 0.7 + detail2 * 0.3);
  cloud = smoothstep(0.1, 1.0, cloud); 
  cloud *= smoothstep(0.35, 1.0, 1.0 - dust * 0.8);
  
  // Colors
  vec3 colDeepRed = vec3(0.2, 0.0, 0.05);
  vec3 colPink = vec3(0.8, 0.1, 0.3);
  vec3 colOrange = vec3(1.0, 0.4, 0.1);
  vec3 colMagenta = vec3(0.6, 0.1, 0.4);
  
  vec3 nebulaCol = mix(colDeepRed, colPink, detail1);
  nebulaCol = mix(nebulaCol, colOrange, detail2 * mask); 
  nebulaCol = mix(nebulaCol, colMagenta, dust * 0.5); 
  
  vec3 finalCloud = nebulaCol * cloud * 2.5 * brightnessMod; // Apply brightness mod

  // ── ORANGE STARS (Nebula Internal) ────────────────────────────────────────
  vec3 orangeStars = vec3(0.0);
  if (cloud > 0.2) {
    orangeStars = starLayer(nebulaUV, 12.0, u_seed + 777.0, vec3(1.0, 0.6, 0.2));
    orangeStars *= smoothstep(0.2, 0.5, cloud);
  }

  // ── LAYER 2: FOREGROUND STARS (Rotation Parallax) ─────────────────────────
  vec3 starsFront = vec3(0.0);
  
  // Faster rotation for closer feeling?
  mat2 rotFast = rotate(angle * 1.2);
  
  vec2 uvStar3 = rotFast * uv + vec2(0.2, 0.8);
  starsFront += starLayer(uvStar3, 20.0, u_seed + 55.0, vec3(1.0)); 
  
  mat2 rotVeryFast = rotate(angle * 1.5);
  vec2 uvStar4 = rotVeryFast * uv + vec2(0.9, 0.3); // Fastest
  starsFront += starLayer(uvStar4, 10.0, u_seed + 99.0, vec3(1.0)); 
  
  // ── SHOOTING STARS ────────────────────────────────────────────────────────
  float shoot = 0.0;
  shoot += shootingStar(uv, u_time, 7.0, 10.0); 
  
  // ── COMPOSITE ─────────────────────────────────────────────────────────────
  
  starsBack *= (1.0 - cloud * 0.8); 
  
  float vig = 1.0 - dot(uv, uv) * 0.4;
  
  vec3 finalColor = bg + starsBack + finalCloud + orangeStars + starsFront + vec3(shoot);
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
  speed = 1.0,
  nebulaSpeed = 1.5,
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
    const uSpeed = gl.getUniformLocation(pgm, "u_speed");
    const uNebulaSpeed = gl.getUniformLocation(pgm, "u_nebula_speed");
    
    gl.uniform1f(uSeed, Math.random() * 10000);
    gl.uniform1f(uSpeed, speed);
    gl.uniform1f(uNebulaSpeed, nebulaSpeed);

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
      gl.uniform1f(uSpeed, speed);
      gl.uniform1f(uNebulaSpeed, nebulaSpeed);
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
  }, [fps, speed, nebulaSpeed]);

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