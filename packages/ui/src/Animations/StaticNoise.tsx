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
 * Static-noise overlay.
 * Use CSS animation
 * Leave old webgl render in comments
 */
export const StaticNoise: React.FC<StaticNoiseProps> = ({
                                                          className = "pointer-events-none fixed inset-0",
                                                          zIndex,
                                                          fps = 30, // don't use now
                                                          storageKey = "staticNoiseVisible",
                                                          defaultVisible = true,
                                                        }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState<boolean>(defaultVisible);

  const NOISE_DATA_URI =
    "data:image/png;base64,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";

  const animationName = "static-noise-random-move";

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
        console.warn("localStorage not available, using default visibility:", defaultVisible);
        setIsVisible(defaultVisible);
      }
    };

    checkVisibility();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) checkVisibility();
    };
    window.addEventListener("storage", handleStorageChange);

    const handleCustomStorageChange = () => checkVisibility();
    window.addEventListener("localStorageChange", handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("localStorageChange", handleCustomStorageChange as EventListener);
    };
  }, [storageKey, defaultVisible]);

  /*
  // ===== Legacy WebGL noise (DISABLED) =====
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
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: false,
    });
    if (!gl) return;

    // --- Resize handling ------------------------------------------------------
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Shader helpers -------------------------------------------------------
    const compileShader = (src: string, type: number): WebGLShader => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
      }
      return shader;
    };

    const VERTEX_SRC = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = (aPosition + 1.0) * 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const FRAGMENT_SRC = `
      precision mediump float;

      uniform vec2 uResolution;
      uniform float uSeed;
      varying vec2 vUv;

      // Improved random hash (no visible patterns)
      float random(vec2 st, float seed) {
        vec3 p3 = fract(vec3(st.xyx) * 0.1031 + seed);
        p3 += dot(p3, p3.yzx + 33.33);
        return min(fract((p3.x + p3.y) * p3.z) * 2.0, 1.0);
      }

      void main() {
        // Use pixel coordinates for per-pixel randomization
        vec2 pixel = floor(gl_FragCoord.xy);
        float val = random(pixel, uSeed);
        float alpha = val;
        val = ceil(val - 0.01) * 0.15;
        if (val < 0.02) discard;
        gl_FragColor = vec4(vec3(val, val, val * 0.95), alpha);
      }
    `;

    // --- Program --------------------------------------------------------------
    const vert = compileShader(VERTEX_SRC, gl.VERTEX_SHADER);
    const frag = compileShader(FRAGMENT_SRC, gl.FRAGMENT_SHADER);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.Link_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // --- Geometry -------------------------------------------------------------
    const quad = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(prog, "uResolution");
    const uSeed = gl.getUniformLocation(prog, "uSeed");

    // --- Render loop ----------------------------------------------------------
    let timer = 0;
    const render = () => {
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uSeed, Math.random() * 1000.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      timer = window.setTimeout(render, 1000 / fps);
    };
    render();

    // --- Cleanup --------------------------------------------------------------
    return () => {
      clearTimeout(timer);
      ro.disconnect();

      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);

      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [fps, isVisible]);
  // ===== End of Legacy WebGL noise (DISABLED) =====
  */

  if (!isVisible) return null;

  return (
    <>
      {/* CSS keyframes for background noise */}
      <style>
        {`
          @keyframes ${animationName} {
            0% { background-position: 234px 0; }
            50% { background-position: 0 123px; }
            100% { background-position: 345px 123px; }
          }
        `}
      </style>

      <div
        ref={boxRef}
        className={className}
        style={{
          zIndex,
          backgroundImage: `url(${NOISE_DATA_URI})`,
          backgroundColor: "rgba(0, 0, 5, 0.88)",
          backgroundBlendMode: "darken",
          animation: `.2s steps(3, jump-none) infinite ${animationName}`,
        }}
        aria-hidden="true"
      />
    </>
  );
};

export default StaticNoise;