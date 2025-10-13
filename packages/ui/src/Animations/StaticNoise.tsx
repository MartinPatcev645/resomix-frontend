import { useEffect, useRef } from "react";

export interface StaticNoiseProps {
  /** Optional Tailwind/utility classes. Defaults to a fullscreen fixed overlay. */
  className?: string;
  /** Optional z-index so you can position above/below other layers. */
  zIndex?: number;
  /** Target frames-per-second for the noise refresh. Defaults to 20 (≈ original). */
  fps?: number;
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
  fps = 30,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
        // tslint:disable-next-line:no-console
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
