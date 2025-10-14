import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * A reusable React wrapper around the "tunnel" full-screen shader demo that lived
 * in `test.html`.  The WebGL / Three.js implementation is self-contained within
 * this file – no external raw helper is required.
 *
 * Usage:
 * ```tsx
 * <div className="w-full h-full">
 *   <Tunnel />
 * </div>
 * ```
 *
 * The component **does not** forward any props (yet).  Feel free to extend it –
 * keep the public API minimal and stable.
 */
export interface TunnelProps {
  /**
   * Desired height / width ratio.  Example: desktop SVG 1268 / 1555 ≈ 0.816.
   * If omitted, defaults to the desktop aspect.
   */
  aspectRatio?: number;
}

export const Tunnel: React.FC<TunnelProps> = ({ aspectRatio }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // ------------------------------------------------------------
    // 1. Basic Three.js setup – renderer / scene / camera
    // ------------------------------------------------------------
    const container = containerRef.current;

    // Maintain original SVG aspect ratio (height/width) at all times.
    const ASPECT = aspectRatio ?? 1268 / 1555; // default desktop

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      -1,
      1,
      1,
      -1,
      0,
      1
    );

    // ------------------------------------------------------------
    // 2. Uniforms – kept 1-1 with original HTML demo
    // ------------------------------------------------------------
    const uniforms: Record<string, THREE.IUniform> = {
      time: { value: 0.0 },
      resolution: {
        value: new THREE.Vector2(
          container.clientWidth,
          container.clientHeight
        ),
      },
    };

    // ------------------------------------------------------------
    // 3. Shader code – verbatim copy from test.html (typed as string)
    // ------------------------------------------------------------
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float time;
      uniform vec2 resolution;
      varying vec2 vUv;

      bool isRectWidth(vec2 uv, float lineWidth, float maxSize,float ratio){
        bool val = false;
        if(((uv.y<maxSize && uv.y>(maxSize-lineWidth*ratio)) || (uv.y>(1.0-maxSize)&& uv.y < (1.0-maxSize+lineWidth*ratio))) && ((uv.x<maxSize) && (uv.x > (1.0-maxSize)) ) ){
           val = true;
        }
        if(((uv.x<maxSize && uv.x>(maxSize-lineWidth)) || (uv.x>(1.0-maxSize)&& uv.x < (1.0-maxSize+lineWidth))) && ((uv.y<maxSize) && (uv.y > (1.0-maxSize)) )){
          val =  true;
        }
        return val;
      }

      float ShowConstantWidthLine(vec2 uv, float lineWidth, float feather, float ratio, int totalLines) {
        uv = (uv - vec2(0.5)) * 2.0;
        uv.x *= ratio;

        float finalValue = 0.0;
        float angleStep = 6.2831853 / float(totalLines);

        for (int i = 0; i < totalLines; i++) {
          float angle = float(i) * angleStep;
          vec2 lineDir = vec2(cos(angle), sin(angle));
          vec2 perpDir = vec2(lineDir.y, -lineDir.x);
          float dist = abs(dot(uv, perpDir));
          float lineIntensity = 1.0 - smoothstep(lineWidth, lineWidth + feather, dist);
          finalValue = max(finalValue, lineIntensity);
        }

        finalValue *= smoothstep(0.0, 0.05, length(uv));
        return finalValue;
      }

      void main() {
        vec2 uv = vUv;
        float ratio = resolution.x / resolution.y;

        float lineWidth = 1.0;
        float lwp = lineWidth / resolution.x;
        vec3 lineCol = vec3(.5,.5,.5);
        float lineColVal = 0.0;
        int maxVal = 6;
        float speedMult = .1;
        float speed = speedMult;
        float invMax = 1.0/float(maxVal);
        float offset = .2;

        if(isRectWidth(uv,lwp,1.0,ratio)){
          lineColVal = 1.0;
        }

        for(int i=0;i<maxVal;i++){
          float value = fract(float(i)*invMax + time*speed)*.5-.05;
          if(isRectWidth(uv,lwp,1.0-value,ratio)){
            lineColVal = 1.0;
          }
        }

        int totalLines = 25;
        float feather = 0.003;

        float lines = ShowConstantWidthLine(uv, lwp, feather, ratio, totalLines);
        lineColVal = max(lineColVal,lines);
        vec3 col = lineCol;
        gl_FragColor = vec4(col, lineColVal);
      }
    `;

    // ------------------------------------------------------------
    // 4. Geometry + material + mesh (full-screen quad)
    // ------------------------------------------------------------
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // ------------------------------------------------------------
    // 5. Animation loop
    // ------------------------------------------------------------
    const clock = new THREE.Clock();
    let rafId = 0;
    const animate = () => {
      uniforms.time.value = clock.getElapsedTime();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    animate();

    // ------------------------------------------------------------
    // 6. Resize handling – keep canvas & uniforms in sync (container-aware)
    // ------------------------------------------------------------
    const resize = () => {
      const w = container.clientWidth;
      if (w === 0) return;
      const expectedH = w * ASPECT;
      if (container.clientHeight !== expectedH) {
        container.style.height = `${expectedH}px`;
      }
      renderer.setSize(w, expectedH);
      uniforms.resolution.value.set(w, expectedH);
    };

    // Observe the container itself – covers dynamic layouts where height is
    // assigned later on (e.g. Tailwind w-full h-full without explicit parent).
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Fallback: also listen to global resize to catch viewport changes
    window.addEventListener("resize", resize);
    // Run once immediately to cater for first non-0 size after mount
    resize();

    // ------------------------------------------------------------
    // 7. Disposer (returned from useEffect)
    // ------------------------------------------------------------
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      renderer.dispose();
      material.dispose();
      geometry.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden pointer-events-none"
    />
  );
};
