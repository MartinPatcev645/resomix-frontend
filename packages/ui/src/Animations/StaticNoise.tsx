// StaticNoise.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface StaticNoiseProps {
  /** Extra vertical coverage outside the viewport, in vh (optional). */
  overscanVh?: number;
}

export const StaticNoise: React.FC<StaticNoiseProps> = ({ overscanVh = 0 }) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = boxRef.current;
    if (!container) return;

    // --- Renderer (transparent, fast, predictable) -------------------------
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

    // --- Scene / camera -----------------------------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // --- Fullscreen quad ----------------------------------------------------
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    // === Fixed look (two-tone) =============================================
    // Precomputed linear values for:
    //   LIGHT sRGB #0a0a07  -> linear ≈ (0.002614, 0.002614, 0.001953)
    //   DARK  sRGB #171716  -> linear ≈ (0.00856813, 0.00856813, 0.00802319)
    const LIGHT_LIN = new THREE.Vector3(0.002614, 0.002614, 0.001953);
    const DARK_LIN  = new THREE.Vector3(0.00856813, 0.00856813, 0.00802319);

    const GRAIN_PX    = 2.0;   // pixel size of speck cells (1 = crisp, 2–3 = larger)
    const DENSITY     = 0.7;  // fraction of cells that become dark specks
    const SHUFFLE_FPS = 30.0;  // refresh rate of the pattern
    const ALPHA       = 1.0;   // overall opacity

    const uniforms = {
      uResolution: { value: new THREE.Vector2(1, 1) },
      uTime:       { value: 0 },
      uLightLin:   { value: LIGHT_LIN },
      uDarkLin:    { value: DARK_LIN },
      uAlpha:      { value: ALPHA },
      uGrainPx:    { value: GRAIN_PX },
      uDensity:    { value: DENSITY },
      uFps:        { value: SHUFFLE_FPS },
    };

    const vertexShader = `void main(){ gl_Position = vec4(position,1.0); }`;

    // Work in linear, encode to sRGB at the end (manual, fast).
    const fragmentShader = `
      precision highp float;
      uniform vec2  uResolution;
      uniform float uTime;
      uniform vec3  uLightLin;
      uniform vec3  uDarkLin;
      uniform float uAlpha;
      uniform float uGrainPx;
      uniform float uDensity;
      uniform float uFps;

      float hash21(vec2 p){
        p = vec2(dot(p, vec2(127.1, 311.7)),
                 dot(p, vec2(269.5, 183.3)));
        return fract(sin(p.x + p.y) * 43758.5453123);
      }

      vec3 linearToSRGB(vec3 x){ return pow(max(x, vec3(0.0)), vec3(1.0/2.2)); }

      void main(){
        vec2 pix  = gl_FragCoord.xy;
        float sz  = max(uGrainPx, 1.0);
        vec2 cell = floor(pix / sz) * sz;

        float frame = mod(floor(uTime * uFps), 1024.0);
        vec2  seed  = vec2(frame, frame * 1.61803398875);

        float n = hash21(cell + seed + vec2(0.73, 0.41));
        float isSpeck = step(1.0 - uDensity, n);

        // Two-tone: light base, dark specks (linear domain)
        vec3 colLin = mix(uLightLin, uDarkLin, isSpeck);

        // Encode to sRGB for display
        vec3 colSRGB = linearToSRGB(colLin);
        gl_FragColor = vec4(colSRGB, uAlpha);
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

    // --- Resize -------------------------------------------------------------
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(canvas.width, canvas.height);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Loop ---------------------------------------------------------------
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
  }, [overscanVh]);

  const extra = overscanVh > 0 ? `${overscanVh}vh` : "0";
  return (
    <div
      ref={boxRef}
      className="pointer-events-none fixed left-0 right-0"
      style={{
        top: `-${extra}`,
        width: "100%",
        height: `calc(100vh + ${overscanVh * 2}vh)`,
        zIndex: undefined,
        opacity: 1,
      }}
      aria-hidden="true"
    />
  );
};
