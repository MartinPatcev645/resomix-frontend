import { useEffect, useRef, useState, useCallback } from "react";

export interface StaticNoiseProps {
  /** Optional Tailwind/utility classes. Defaults to a fullscreen fixed overlay. */
  className?: string;
  /** Optional z-index so you can position above/below other layers. */
  zIndex?: number;
  /** Target frames-per-second for the render loop. Defaults to 60. */
  fps?: number;
  /** localStorage variable name to check for visibility. Defaults to 'staticNoiseVisible'. */
  storageKey?: string;
  /** Default visibility state if no localStorage value is found. Defaults to true. */
  defaultVisible?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════════════
   GLSL Shaders — Animated space background (starfield, nebula, shooting
   stars, film grain, vignette). Ported from final-bg.jsx.
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

highp float hash(highp vec2 p) {
  highp vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.0;
    a *= 0.5;
  }
  return v;
}

mat2 rotate(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float starLayer(vec2 uv, float density, float seed) {
  vec2 id = floor(uv * density);
  vec2 gv = fract(uv * density) - 0.5;
  float rnd = hash(id + seed * 0.001);
  if (rnd < 0.88) return 0.0;
  float rnd2 = hash(id * 1.7 + 31.0);
  float rnd3 = hash(id * 2.3 + 57.0);
  vec2 offset = (vec2(hash(id + 10.0), hash(id + 20.0)) - 0.5) * 0.7;
  float d = length(gv - offset);
  float size = 0.003 + 0.012 * rnd2;
  float core = smoothstep(size, size * 0.15, d);
  float glow = rnd2 * 0.3 * smoothstep(size * (3.0 + 4.0 * rnd3), 0.0, d);
  float twinkle = 0.6 + 0.4 * sin(u_time * (0.8 + 1.5 * rnd3) + rnd * 6.2831);
  return (core + glow) * twinkle;
}

float shootingStar(vec2 uv, float t, float interval, float slot) {
  float cycle = floor(t / interval);
  float local = t - cycle * interval;
  float duration = 1.8;
  if (local > duration) return 0.0;
  float progress = local / duration;
  float r1 = hash(vec2(cycle + slot, slot + 7.0));
  float r2 = hash(vec2(cycle + slot, slot + 13.0));
  float r3 = hash(vec2(cycle + slot, slot + 23.0));
  vec2 origin = vec2(mix(-0.6, 0.6, r1), mix(0.2, 0.5, r2));
  float angle = mix(-0.8, -2.3, r3);
  vec2 dir = vec2(cos(angle), sin(angle));
  float speed = 0.6 + 0.4 * r2;
  vec2 head = origin + dir * progress * speed;
  float trailLen = 0.12 + 0.08 * r1;
  vec2 tail = head - dir * trailLen;
  vec2 pa = uv - tail;
  vec2 ba = head - tail;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);
  float streak = smoothstep(0.0015, 0.0002, d);
  streak *= h;
  float fade = smoothstep(0.0, 0.1, progress) * smoothstep(1.0, 0.6, progress);
  return streak * fade * (0.8 + 0.2 * r3);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - u_res * 0.5) / min(u_res.x, u_res.y);
  vec2 px = gl_FragCoord.xy;
  float t = u_time;

  float rotSpeed = 0.008;
  vec2 ruv1 = rotate(t * rotSpeed) * uv;
  vec2 ruv2 = rotate(t * rotSpeed * 1.15) * uv;
  vec2 ruv3 = rotate(t * rotSpeed * 1.35) * uv;

  // ── STARFIELD
  float stars = 0.0;
  stars += starLayer(ruv1, 50.0, u_seed) * 0.35;
  stars += starLayer(ruv2 + 100.0, 30.0, u_seed + 50.0) * 0.6;
  stars += starLayer(ruv3 + 200.0, 12.0, u_seed + 100.0) * 1.0;

  // ── ETHEREAL NEBULA
  float aspect = u_res.x / u_res.y;
  vec2 nUV = vec2(ruv1.x * aspect, ruv1.y);

  // Layer A: deep veil (low freq, slow, very subtle)
  float veil = fbm(nUV * 1.2 + vec2(t * 0.006, -t * 0.004) + 80.0);
  veil = pow(veil, 2.5) * 0.055;
  vec3 veilColor = vec3(0.6, 0.15, 0.02) * veil;

  // Layer B: mid structure
  float smoke1 = fbm(nUV * 2.2 + vec2(0.0, t * 0.018));
  float smoke2 = fbm(nUV * 1.5 + vec2(t * 0.012, 0.0) + 50.0);
  smoke1 = pow(smoke1, 3.7) * 0.08;
  smoke2 = pow(smoke2, 3.9) * 0.06;
  vec3 smokeColor = vec3(1.0, 0.4, 0.03) * smoke1
                  + vec3(0.9, 0.55, 0.1) * smoke2;

  // Layer C: hot core filaments
  float core = fbm(nUV * 3.8 + vec2(-t * 0.01, t * 0.022) + 120.0);
  core = pow(core, 4.5) * 0.1;
  vec3 coreColor = vec3(1.0, 0.3, 0.0) * core;

  // Additive layering = translucent overlap bloom
  vec3 nebula = veilColor + smokeColor + coreColor;

  // ── SHOOTING STARS (delayed 4.5s, then every ~17s)
  float shoot = 0.0;
  float shootT = t - 4.5;
  if (shootT > 0.0) {
    shoot += shootingStar(uv, shootT, 17.0, 0.0);
    shoot += shootingStar(uv, shootT + 8.5, 17.0, 50.0);
  }

  // ── GRAIN
  float grain = hash(px + fract(t * 43758.5453 + u_seed) * 171.31);
  grain = pow(grain, 1.6) * 0.045;

  // ── VIGNETTE
  float vignette = 1.0 - dot(uv, uv) * 0.6;
  vignette = clamp(pow(max(vignette, 0.0), 0.5), 0.0, 1.0);

  // ── COMPOSITE
  vec3 color = vec3(0.0);
  color += vec3(stars) * vignette;
  color += nebula * vignette;
  color += vec3(shoot);
  color += vec3(grain);

  gl_FragColor = vec4(color, 1.0);
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

/**
 * Animated space-background overlay implemented with raw WebGL.
 *
 * Renders a starfield with twinkling stars, ethereal orange nebula wisps,
 * periodic shooting stars, subtle film grain and a vignette — all running
 * in a single fragment shader.
 *
 * Visibility can be toggled via localStorage (key configurable through props)
 * and is synchronised across tabs via storage events.
 */
export const StaticNoise: React.FC<StaticNoiseProps> = ({
  className = "pointer-events-none fixed inset-0",
  zIndex,
  fps = 60,
  storageKey = "staticNoiseVisible",
  defaultVisible = true,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(defaultVisible);

  /* ── localStorage visibility toggle ──────────────────────────────────── */
  useEffect(() => {
    const checkVisibility = () => {
      try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue !== null) {
          setIsVisible(storedValue === "true");
        } else {
          localStorage.setItem(storageKey, defaultVisible.toString());
          setIsVisible(defaultVisible);
        }
      } catch {
        console.warn(
          "localStorage not available, using default visibility:",
          defaultVisible,
        );
        setIsVisible(defaultVisible);
      }
    };

    checkVisibility();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) checkVisibility();
    };
    const handleCustomStorageChange = () => checkVisibility();

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "localStorageChange",
      handleCustomStorageChange as EventListener,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "localStorageChange",
        handleCustomStorageChange as EventListener,
      );
    };
  }, [storageKey, defaultVisible]);

  /* ── WebGL lifecycle ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isVisible) return;

    const container = boxRef.current;
    if (!container) return;

    // --- Canvas / GL context ------------------------------------------------
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.background = "#000";
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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const currentW = Math.max(
        1,
        Math.floor(container.clientWidth * dpr),
      );
      const currentH = Math.max(
        1,
        Math.floor(container.clientHeight * dpr),
      );

      const widthIncreased = currentW > prevSize.w;
      const widthDecreasedSignificantly = prevSize.w - currentW > 120 * dpr;
      const heightIncreased = currentH > prevSize.h;
      const heightDecreasedSignificantly =
        prevSize.h - currentH > 120 * dpr;

      const shouldUpdate =
        force ||
        prevSize.w === 0 ||
        widthIncreased ||
        widthDecreasedSignificantly ||
        heightIncreased ||
        heightDecreasedSignificantly;

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
  }, [fps, isVisible]);

  if (!isVisible) return null;

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