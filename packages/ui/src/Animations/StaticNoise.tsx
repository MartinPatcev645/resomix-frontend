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
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.setClearColor(0x000000, 0);
    (renderer as any).toneMapping = (THREE as any).NoToneMapping ?? 0;
    if ("SRGBColorSpace" in THREE && "outputColorSpace" in renderer) {
      (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace; // r152+
    } else {
      (renderer as any).outputEncoding = (THREE as any).sRGBEncoding; // <= r151
    }

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

    // --- Tunables (picked to match a subtle, isotropic film-grain look) ----
    const SHUFFLE_FPS = 30.0;   // pattern refresh rate
    const ALPHA       = 1.0;    // overlay alpha multiplier
    const DENSITY     = 0.65;   // per-layer dot probability (combined across layers)
    // Per-layer nominal cell sizes in device pixels (small -> finer grain)
    const L0_SIZE_PX  = 1.6;
    const L1_SIZE_PX  = 2.2;
    const L2_SIZE_PX  = 3.0;

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
    };

    const vertexShader = `
      void main(){
        gl_Position = vec4(position, 1.0);
      }
    `;

    // Fragment shader:
    // - Builds three interleaved layers of *round* grains (soft discs) at different cell sizes.
    // - Each layer is rendered in a *rotated* coordinate frame (per-frame random angles),
    //   which breaks axis-aligned grid artifacts.
    // - Randomness is reseeded per frame via hashed frame indices (no coherent translation),
    //   avoiding the “diagonal drifting” feel.
    // - Output is black dots with alpha (transparent elsewhere), so it sits over your existing background.
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

      // --- Hash helpers (good decorrelation, cheap) ------------------------
      // 2D -> 1D
      float hash11(float n){
        // https://www.shadertoy.com/view/4djSRW style
        return fract(sin(n) * 43758.5453123);
      }
      float hash21(vec2 p){
        // Spatial hash with mix of dot + sin (good enough for grain)
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float hash31(vec3 p){
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }

      // Random angle per layer per frame (no linear drift)
      float frameAngle(int layer, float frameIdx){
        // Layer tag baked into the hash input
        return 6.28318530718 * hash31(vec3(float(layer) + 0.37, frameIdx * 0.137, 0.777));
      }

      // Rotate a point by angle theta
      mat2 rot(float a){
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
      }

      // One grain layer: round dots in a rotated, jittered lattice.
      // Returns alpha contribution [0..1] for this layer.
      float layerGrain(vec2 pix, float cellPx, float density, float frameIdx, int layerId){
        // Rotate coordinate frame to break axis-aligned grid artifacts.
        float theta = frameAngle(layerId, frameIdx);
        vec2 q = rot(theta) * pix;

        // Identify cell
        vec2 cell = floor(q / cellPx);
        vec2 cellBase = cell * cellPx;

        // Hash per cell + frame (no translation drift)
        float h0 = hash31(vec3(cell, frameIdx * 0.73 + float(layerId) * 2.11));

        // Decide if this cell spawns a dot this frame
        if (h0 > density) return 0.0;

        // Random center inside the cell (uniform jitter)
        float hx = hash31(vec3(cell + 3.1, frameIdx * 1.23 + float(layerId) * 1.7));
        float hy = hash31(vec3(cell + 7.9, frameIdx * 2.37 + float(layerId) * 0.9));
        vec2 jitter = vec2(hx, hy); // [0,1)
        vec2 center = cellBase + (jitter + 0.5) * cellPx; // avoid edges

        // Dot radius: small jitter to make grains feel organic, scaled to cell size
        float hr = hash31(vec3(cell + 11.7, frameIdx * 3.1 + float(layerId) * 4.2));
        float r = mix(0.33, 0.55, hr) * cellPx;  // ~1/3..1/2 of cell size

        // Distance in rotated frame (since q is rotated)
        float d = length(q - center);

        // Soft disc mask for anti-aliased rounds (smooth edge over ~1 px)
        float edge = 1.0; // falloff width in px
        float a = smoothstep(r, r - edge, d); // 0 outside -> 1 inside

        return a;
      }

      void main(){
        vec2 pix = gl_FragCoord.xy; // device pixels

        // Frame index (discrete at uFps; capped large)
        float frameIdx = mod(floor(uTime * uFps), 4096.0);

        // Accumulate alpha from three independent grain layers
        float a0 = layerGrain(pix, uSizePx0, uDensity, frameIdx + 13.0, 0);
        float a1 = layerGrain(pix, uSizePx1, uDensity, frameIdx + 37.0, 1);
        float a2 = layerGrain(pix, uSizePx2, uDensity, frameIdx + 71.0, 2);

        // Combine with "screened" max to keep dot edges crisp but additive
        float a = max(a0, max(a1, a2));

        // Overall opacity
        float alpha = a * uAlpha;

        if (alpha <= 0.001) discard; // cheaper blending

        // Black dots (let underlying page color show through elsewhere)
        gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
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
      // Use actual device pixel dimensions for the shader
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
