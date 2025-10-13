// StaticNoise.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";

type Triplet = [number, number, number];
type SizeSet = { sm?: Triplet; md?: Triplet; lg?: Triplet };

export interface StaticNoiseProps {
  className?: string;
  zIndex?: number;
  /** Target refresh FPS for the noise shuffle. */
  fps?: number;

  /** DARK dot layer config (your current default). */
  dark?: {
    enabled?: boolean;          // default true
    color?: Triplet;             // hex, default "#121211"
    density?: number;           // 0..1, default 1
    alpha?: number;             // 0..1, default 1
    edge?: number;              // px softness, default 0.5
    radiusFactor?: number;      // r = radiusFactor * cellPx, default 0.5
    sizes?: SizeSet;            // per-breakpoint [L0, L1, L2] cell sizes in px
  };

  /** LIGHT dot layer config. */
  light?: {
    enabled?: boolean;          // default false
    color?: Triplet;             // hex, default "#161615"
    density?: number;           // 0..1, default 1
    alpha?: number;             // 0..1, default 1
    edge?: number;              // px softness, default 0.5
    radiusFactor?: number;      // r = radiusFactor * cellPx, default 0.5
    sizes?: SizeSet;            // per-breakpoint [L0, L1, L2] cell sizes in px
  };
}

// ---- Defaults (exactly match your current rendering) -----------------------
const DEF_FPS = 30;
const DEF_DARK: Required<NonNullable<StaticNoiseProps["dark"]>> = {
  enabled: true,
  color: [5/255, 5/255, 5/255] as Triplet,
  density: 1,
  alpha: 0.99,
  edge: 0.4,
  radiusFactor: 0.5,
  sizes: {
    sm: [2.3, 2.8, 4.2],
    md: [2.5, 3.0, 4.5],
    lg: [2.7, 3.2, 4.8],
  },
};
const DEF_LIGHT: Required<NonNullable<StaticNoiseProps["light"]>> = {
  enabled: false,
  color: [22/255, 22/255, 21/255] as Triplet,
  density: 1,
  alpha: 1,
  edge: 0.5,
  radiusFactor: 0.5,
  sizes: {
    sm: [2.5, 3.0, 4.5],
    md: [2.5, 3.0, 4.5],
    lg: [2.5, 3.0, 4.5],
  },
};

function pickSizes(sizes: SizeSet | undefined, fallback: Triplet): Triplet {
  // Tailwind-ish breakpoints based on viewport width
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const sm = (sizes?.sm ?? fallback) as Triplet;
  const md = (sizes?.md ?? fallback) as Triplet;
  const lg = (sizes?.lg ?? fallback) as Triplet;
  return w < 640 ? sm : w < 1024 ? md : lg;
}

// Keep the same export symbol so your imports don't break.
export const StaticNoise: React.FC<StaticNoiseProps> = ({
  className = "pointer-events-none fixed inset-0",
  zIndex,
  fps = DEF_FPS,
  dark,
  light,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    const d = { ...DEF_DARK, ...(dark || {}) };
    const l = { ...DEF_LIGHT, ...(light || {}) };

    // Resolve responsive sizes (Triplets) for each layer set
    const [d0, d1, d2] = pickSizes(d.sizes, DEF_DARK.sizes.md!);
    const [l0, l1, l2] = pickSizes(l.sizes, DEF_LIGHT.sizes.md!);

    // --- Renderer (transparent overlay) ------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(container.clientWidth, container.clientHeight, false);

    // Transparent clear
    renderer.setClearColor(0x000000, 0);

    // Keep tonemapping off
    (renderer as any).toneMapping = (THREE as any).NoToneMapping ?? 0;

    // three r152+ uses outputColorSpace (your 0.178 is in this bucket)
    (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;

    const canvas = renderer.domElement as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.pointerEvents = "none";
    container.appendChild(canvas);

    // --- Scene / Camera -----------------------------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- Fullscreen quad ----------------------------------------------------
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    // --- Uniforms -----------------------------------------------------------
    const uniforms = {
      uResolution:   { value: new THREE.Vector2(1, 1) },
      uTime:         { value: 0 },
      uFps:          { value: fps },

      // Dark set
      uDark: { value: new THREE.Vector3(d.color[0], d.color[1], d.color[2]) },
      uDensityDark:  { value: d.enabled ? d.density : 0.0 },
      uAlphaDark:    { value: d.enabled ? d.alpha : 0.0 },
      uEdgeDark:     { value: d.edge },
      uRFactorDark:  { value: d.radiusFactor },
      uSizePxD0:     { value: d0 },
      uSizePxD1:     { value: d1 },
      uSizePxD2:     { value: d2 },

      // Light set
      uGray: { value: new THREE.Vector3(l.color[0], l.color[1], l.color[2]) },
      uDensityLight: { value: l.enabled ? l.density : 0.0 },
      uAlphaLight:   { value: l.enabled ? l.alpha : 0.0 },
      uEdgeLight:    { value: l.edge },
      uRFactorLight: { value: l.radiusFactor },
      uSizePxL0:     { value: l0 },
      uSizePxL1:     { value: l1 },
      uSizePxL2:     { value: l2 },
    };

    const vertexShader = `
      void main(){
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;

      uniform vec2  uResolution; // in device pixels
      uniform float uTime;        // seconds
      uniform float uFps;

      // Dark
      uniform vec3  uDark;
      uniform float uDensityDark;
      uniform float uAlphaDark;
      uniform float uEdgeDark;
      uniform float uRFactorDark;
      uniform float uSizePxD0;
      uniform float uSizePxD1;
      uniform float uSizePxD2;

      // Light
      uniform vec3  uGray;
      uniform float uDensityLight;
      uniform float uAlphaLight;
      uniform float uEdgeLight;
      uniform float uRFactorLight;
      uniform float uSizePxL0;
      uniform float uSizePxL1;
      uniform float uSizePxL2;

      // --- Hash helpers -----------------------------------------------------
      float hash31(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      float frameAngle(int layer, float frameIdx){
        return 6.28318530718 * hash31(vec3(float(layer) + 0.37, frameIdx * 0.137, 0.777));
      }

      mat2 rot(float a){
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      // One grain layer: round dots in a rotated, jittered lattice.
      float layerGrain(vec2 pix, float cellPx, float density, float frameIdx, int layerId, float rFactor, float edge){
        float theta = frameAngle(layerId, frameIdx);
        vec2 q = rot(theta) * pix;

        vec2 cell = floor(q / cellPx);
        vec2 cellBase = cell * cellPx;

        float h0 = hash31(vec3(cell, frameIdx * 0.73 + float(layerId) * 2.11));
        if (h0 > density) return 0.0;

        float hx = hash31(vec3(cell + 3.1, frameIdx * 1.23 + float(layerId) * 1.7));
        float hy = hash31(vec3(cell + 7.9, frameIdx * 2.37 + float(layerId) * 0.9));
        vec2 jitter = vec2(hx, hy);
        vec2 center = cellBase + (jitter + 0.5) * cellPx;

        float r = rFactor * cellPx;

        float d = length(q - center);
        float a = smoothstep(r, r - edge, d);
        return a;
      }
      float random(vec2 st, float seed) {
         vec3 p3 = fract(vec3(st.xyx) * 0.1031 + seed);
         p3 += dot(p3, p3.yzx + 33.33);
         return fract((p3.x + p3.y) * p3.z);
      }
      void main(){
        vec2 pix = gl_FragCoord.xy;

        // Frame index (discrete at uFps)
        float frameIdx = mod(floor(uTime * uFps), 4096.0);

        // ---- DARK DOTS -----------------------------------------------------
        //float a0D = layerGrain(pix, uSizePxD0, uDensityDark, frameIdx + 13.0, 0, uRFactorDark, uEdgeDark);
        //float a1D = layerGrain(pix, uSizePxD1, uDensityDark, frameIdx + 37.0, 1, uRFactorDark, uEdgeDark);
        //float a2D = layerGrain(pix, uSizePxD2, uDensityDark, frameIdx + 71.0, 2, uRFactorDark, uEdgeDark);
        //float aDark = max(a0D, max(a1D, a2D));
        //float alphaDark = aDark * uAlphaDark;

        // ---- LIGHT DOTS ----------------------------------------------------
        //float a0G = layerGrain(pix, uSizePxL0, uDensityLight, frameIdx + 113.0, 10, uRFactorLight, uEdgeLight);
        //float a1G = layerGrain(pix, uSizePxL1, uDensityLight, frameIdx + 137.0, 11, uRFactorLight, uEdgeLight);
        //float a2G = layerGrain(pix, uSizePxL2, uDensityLight, frameIdx + 171.0, 12, uRFactorLight, uEdgeLight);
        //float aGray = max(a0G, max(a1G, a2G));
        //float alphaLight = aGray * uAlphaLight;

        // Composite: take whichever dot dominates at each pixel
        //float alpha = max(alphaDark, alphaLight);
        //if (alpha <= 0.001) discard;

        //vec3 col = (alphaDark >= alphaLight) ? uDark : uGray;
        vec3 col = vec3(pow(pow(random(pixel, uSeed),.5)*.8,2.0)*.6);
        gl_FragColor = vec4(col, col.x);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false as any,
    });

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);

    // --- Resize handling ----------------------------------------------------
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Render loop --------------------------------------------------------
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      (uniforms.uTime.value as number) = (performance.now() - t0) / 1000;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    // --- Cleanup ------------------------------------------------------------
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      geom.dispose();
      mat.dispose();
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [fps, dark, light]);

  return (
    <div
      ref={boxRef}
      className={className}
      style={{ zIndex, opacity: 1 }}
      aria-hidden="true"
    />
  );
};

export default StaticNoise;
