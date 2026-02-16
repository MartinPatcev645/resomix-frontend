import { useEffect, useRef, useState } from "react";

export interface StaticNoiseProps {
  /** Optional Tailwind/utility classes. Defaults to a fullscreen fixed overlay. */
  className?: string;
  /** Optional z-index so you can position above/below other layers. */
  zIndex?: number;
  /** Target frames-per-second for the noise refresh. Defaults to 20 (≈ original). */
  fps?: number;
  /** localStorage variable name to check for visibility. Defaults to 'staticNoiseVisible'. */
  storageKey?: string;
  /** Default visibility state if no localStorage value is found. Defaults to true. */
  defaultVisible?: boolean;
}

/**
 * Static-noise overlay implemented with raw WebGL (no three.js).
 *
 * The fragment shader and render loop are lifted verbatim from the
 * `test - Copy (2).html` proof-of-concept, packaged here as a reusable React
 * component. Behaviour, look and performance should be **identical** to the
 * HTML demo, merely wrapped for convenient reuse across pages.
 */
export const StaticNoise: React.FC<StaticNoiseProps> = ({
  className = "pointer-events-none fixed inset-0",
  zIndex,
  fps = 20,
  storageKey = "staticNoiseVisible",
  defaultVisible = true,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(defaultVisible);

  // Check localStorage on component mount and set up storage event listener
  useEffect(() => {
    const checkVisibility = () => {
      try {
        const storedValue = localStorage.getItem(storageKey);
        if (storedValue !== null) {
          setIsVisible(storedValue === "true");
        } else {
          // If no value exists, set the default
          localStorage.setItem(storageKey, defaultVisible.toString());
          setIsVisible(defaultVisible);
        }
      } catch (error) {
        // Fallback if localStorage is not available
        console.warn("localStorage not available, using default visibility:", defaultVisible);
        setIsVisible(defaultVisible);
      }
    };

    // Check initial value
    checkVisibility();

    // Listen for storage changes (from other tabs/windows)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        checkVisibility();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Optional: Also listen for custom events if you want to update from same tab
    const handleCustomStorageChange = () => {
      checkVisibility();
    };

    window.addEventListener("localStorageChange", handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleCustomStorageChange as EventListener);
    };
  }, [storageKey, defaultVisible]);

  useEffect(() => {
    // Don't initialize WebGL if not visible
    if (!isVisible) return;

    const container = boxRef.current;
    if (!container) return;

    // --- Canvas / GL context --------------------------------------------------
    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.mixBlendMode = "multiply"; // Creates "Dark Static" effect
    canvas.style.opacity = "0.20";          // Controls intensity
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "low-power",
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) return;

    // --- Resize handling ------------------------------------------------------
    const prevSize = { w: 0, h: 0 };
    const scale = 1;

    const resize = (force = false) => {
      const dpr = window.devicePixelRatio || 1;
      const currentW = Math.max(1, Math.floor(container.clientWidth * dpr * scale));
      const currentH = Math.max(1, Math.floor(container.clientHeight * dpr * scale));

      // Always update on increase; only update on decrease if > 120px to prevent iOS flickering
      const widthIncreased = currentW > prevSize.w;
      const widthDecreasedSignificantly = prevSize.w - currentW > 120 * dpr;
      const heightIncreased = currentH > prevSize.h;
      const heightDecreasedSignificantly = prevSize.h - currentH > 120 * dpr;

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

        // Immediate draw if uniforms are available (they are set up below)
        if (uOffset) {
          gl.uniform2f(uOffset, Math.random(), Math.random());
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
      }
    };

    // --- Shader helpers -------------------------------------------------------
    const compileShader = (src: string, type: number): WebGLShader => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        // tslint:disable-next-line:no-console
        console.error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const VERTEX_SRC = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const FRAGMENT_SRC = `
      precision mediump float;

      uniform sampler2D uNoise;
      uniform vec2 uTexelScale;
      uniform vec2 uOffset;

      void main() {
        vec2 uv = fract(gl_FragCoord.xy * uTexelScale + uOffset);
        float n = texture2D(uNoise, uv).r;
        
        // Opaque Grayscale Noise for Safari/iOS stability:
        // We output raw noise and let CSS "multiply" blend mode create the dark static effect.
        gl_FragColor = vec4(vec3(n), 1.0);
      }
    `;

    // --- Program --------------------------------------------------------------
    const vert = compileShader(VERTEX_SRC, gl.VERTEX_SHADER);
    const frag = compileShader(FRAGMENT_SRC, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      // tslint:disable-next-line:no-console
      console.error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // --- Geometry -------------------------------------------------------------
    const quad = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTexelScale = gl.getUniformLocation(prog, "uTexelScale");
    const uOffset = gl.getUniformLocation(prog, "uOffset");
    const uNoise = gl.getUniformLocation(prog, "uNoise");

    const TEX_SIZE = 256;
    const data = new Uint8Array(TEX_SIZE * TEX_SIZE * 4);
    for (let p = 0; p < data.length; p += 4) {
      const v = (Math.random() * 255) | 0;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      data[p + 3] = 255;
    }
    const tex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TEX_SIZE, TEX_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.uniform1i(uNoise, 0);
    gl.uniform2f(uTexelScale, 1.0 / TEX_SIZE, 1.0 / TEX_SIZE);

    // Now that uniforms are ready, start observing resize
    const ro = new ResizeObserver(() => resize(false));
    ro.observe(container);
    resize(true); // Initial force resize to populate dimensions and draw first frame

    // --- Render loop ----------------------------------------------------------
    let raf = 0;
    let last = 0;
    const interval = 1000 / Math.max(1, fps);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (now - last < interval) return;
      last = now;
      gl.uniform2f(uOffset, Math.random(), Math.random());
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

    // --- Cleanup --------------------------------------------------------------
    return () => {
      stop();
      ro.disconnect();

      document.removeEventListener("visibilitychange", onVis);

      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
      gl.deleteTexture(tex);

      // Force context loss to reclaim GPU resources immediately
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();

      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [fps, isVisible]); // Added isVisible as dependency

  // Don't render anything if not visible
  if (!isVisible) {
    return null;
  }

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