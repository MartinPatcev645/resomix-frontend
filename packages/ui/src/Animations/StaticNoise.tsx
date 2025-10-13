// StaticNoise.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";

// Keep the same export symbol so your imports don't break.
export const StaticNoise: React.FC = () => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    // --- Renderer (transparent overlay) ------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(256, 256, false);

    // Transparent clear
    renderer.setClearColor(0x000000, 0);

    // Keep tonemapping off
    (renderer as any).toneMapping = (THREE as any).NoToneMapping ?? 0;

    // three r152+ uses outputColorSpace (your 0.178 is in this bucket)
    // Do NOT reference sRGBEncoding (removed in modern three)
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

    // --- Tunables -----------------------------------------------------------
    const SHUFFLE_FPS = 30.0;   // pattern refresh rate
    const ALPHA       = 1.0;    // overlay alpha multiplier
    const DENSITY     = 0.90;   // increased from 0.65
    // Per-layer nominal cell sizes in device pixels (small -> finer grain)
    const L0_SIZE_PX  = 2;
    const L1_SIZE_PX  = 3;
    const L2_SIZE_PX  = 4;

    // --- Uniforms -----------------------------------------------------------
    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) }, // (canvas.width, canvas.height)
      uTime:       { value: 0 },
      uFps:        { value: SHUFFLE_FPS },
      uAlpha:      { value: ALPHA },
      uDensity:    { value: DENSITY },
      uSizePx0:    { value: L0_SIZE_PX },
      uSizePx1:    { value: L1_SIZE_PX },
      uSizePx2:    { value: L2_SIZE_PX },
      // Dark set (formerly slightly black) -> #121211
      uDark:       { value: new THREE.Vector3(9/255, 9/255, 8/255) },  // 18/255, 18/255, 17/255
      // Lighter set (still darker than #1B1B1A) -> #161615
      uGray:       { value: new THREE.Vector3(22/255, 22/255, 21/255) },
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
      uniform float uAlpha;
      uniform float uDensity;
      uniform float uSizePx0;
      uniform float uSizePx1;
      uniform float uSizePx2;
      uniform vec3  uDark;        // #121211
      uniform vec3  uGray;        // #161615

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
      float layerGrain(vec2 pix, float cellPx, float density, float frameIdx, int layerId){
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

        float hr = hash31(vec3(cell + 11.7, frameIdx * 3.1 + float(layerId) * 4.2));
        float r = mix(0.33, 0.55, hr) * cellPx;

        float d = length(q - center);
        float edge = 1.0; // falloff width in px
        float a = smoothstep(r, r - edge, d);
        return a;
      }

      void main(){
        vec2 pix = gl_FragCoord.xy;

        // Frame index (discrete at uFps)
        float frameIdx = mod(floor(uTime * uFps), 4096.0);

        // ---- DARK DOTS (formerly black) -----------------------------------
        float a0D = layerGrain(pix, uSizePx0, uDensity, frameIdx + 13.0, 0);
        float a1D = layerGrain(pix, uSizePx1, uDensity, frameIdx + 37.0, 1);
        float a2D = layerGrain(pix, uSizePx2, uDensity, frameIdx + 71.0, 2);
        float aDark = max(a0D, max(a1D, a2D));

        // ---- LIGHTER DOTS (independent seeds) ------------------------------
        float a0G = layerGrain(pix, uSizePx0, uDensity, frameIdx + 113.0, 10);
        float a1G = layerGrain(pix, uSizePx1, uDensity, frameIdx + 137.0, 11);
        float a2G = layerGrain(pix, uSizePx2, uDensity, frameIdx + 171.0, 12);
        float aGray = max(a0G, max(a1G, a2G));

        // Union alpha for coverage; keep edges crisp
        float a = max(aDark, aGray);
        float alpha = a * uAlpha;
        if (alpha <= 0.001) discard;

        // Prefer the darker tone when overlapping
        vec3 col = (aDark >= aGray) ? uDark : uGray;

        gl_FragColor = vec4(col, alpha);
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
      renderer.setSize(265, 256, false);
      uniforms.uResolution.value.set(canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Render loop --------------------------------------------------------
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      uniforms.uTime.value = (performance.now() - t0) / 1000;
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
  }, []);

  return (
    <div
      ref={boxRef}
      className="pointer-events-none fixed inset-0"
      style={{
        // Fully cover viewport; zIndex left undefined so you can control in parent if needed
        zIndex: undefined,
        opacity: 1,
      }}
      aria-hidden="true"
    />
  );
};

export default StaticNoise;
