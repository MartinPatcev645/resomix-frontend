import ResizeObserver from "resize-observer-polyfill";

/**
 * Initializes the "Remains" WebGL2 shader animation inside the provided container.
 * Returns a disposer you MUST call on unmount.
 */
export function initRemains(container: HTMLElement): () => void {
  /* ------------------------------------------------------------------
   * Canvas / WebGL2 context
   * ------------------------------------------------------------------ */
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.userSelect = "none";
  canvas.style.pointerEvents = "none";
  container.appendChild(canvas);

  const gl = canvas.getContext("webgl2", { alpha: true });
  if (!gl) {
    console.warn("WebGL2 is not supported in this browser");
    return () => {
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }

  const DPR = Math.max(1, 0.5 * window.devicePixelRatio);

  /* ------------------------------------------------------------------
   * Resize handling
   * ------------------------------------------------------------------ */
  const resize = () => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    canvas.width = width * DPR * 0.65;
    canvas.height = height * DPR * 0.65;

    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ------------------------------------------------------------------
   * Shader source
   * ------------------------------------------------------------------ */
  const vertexSource = `#version 300 es
  precision mediump float;

  in vec4 position;

  void main(void) {
    gl_Position = position;
  }`;

  const fragmentSource = `#version 300 es
  /*********
  * made by Matthias Hurrle (@atzedent) 
  */

  precision mediump float;


  out vec4 fragColor;

  uniform vec2 resolution;
  uniform float time;
  uniform int pointerCount;
  uniform vec2 touch;

  #define P pointerCount
  #define mouse (touch/resolution)

  #define S smoothstep
  #define LIGHTS vec3(0,0,1)

  #define T mod(55.+time, 5000.)
  #define TICK step(.5, curve(12. + T * 5e-1, 4.))
  #define TIME (T * mix(1. , -1.5, TICK))

  mat2 rot(float a) {
    float s = sin(a),
    c = cos(a);

    return mat2(c, -s, s, c);
  }

  float rnd(float a) {
    return 1.0;//fract(sin(a * 12.599) * 78.233);
  }

  float curve(float t, float e) {
    t /= e;

    return mix(
      rnd(floor(t)),
      rnd(floor(t) + 1.),
      pow(S(.0, 1., fract(t)), 10.)
    );
  }

  float map(vec3 p) {
    float d = 5e5, tt = TIME,
    t = 10.*floor(1.+10.*pow(S(.0,1.,fract(tt*.005)),.5)),
    f = 1.;

    for (float i = .0; i < 10.; i++) {
      p.xz *= rot(t/f);
      p = abs(p)-.8625*f;
      d = min(d, max(p.x, max(p.y, p.z)));
      f *= .58258;
    }

    return -d;
  }

  float shadow(vec3 p, vec3 rd, float maxd, int steps, float limit) {
    float shad=1., dd=.0;

    for(int i=0; i<steps; i++) {
      float d=map(p);

      if(d < limit) {
        shad = .0;
        break;
      }

      if(dd > maxd) {
        d = maxd;
        break;
      }

      p += rd*d;
      dd+= d;
    }

    return shad;
  }

  float vol(vec3 p, vec3 rd, vec3 ro, float maxd) {
    const float s = .2;
    float distort = 1.0,//fract(sin(dot(p.xy, p.yx+vec2(234, 543)))*345678.),
    d = s * distort,
    at = .0;

    vec3 vr = rd*s,
    vp = ro + vr * distort;

    for (float i = .0; i < 10.; i++) {
      if (d > maxd) break;

      float ldst = max(length(vp-LIGHTS), 1e-3),
      attn = 1./(1.+ldst*.1+ldst*ldst*.05),
        shd = shadow(vp, LIGHTS, d, 2, 1e-3)*attn;
      
      at += .1*(.2/ldst)*shd;
      vp += vr;
      d += s;
    }

    return pow(at*4.2, 4.);
  }

  void cam(inout vec3 p) {
    if (P > 0) {
      p.yz *= rot(-mouse.y*3.1415+1.5707);
      p.xz *= rot(3.1415-mouse.x*6.2832);
    } else {
      float t = TIME, s = sin(t * .05)*.75;
      p.yz *= rot(sin(t * .025) * .2);
      p.xy *= rot(s * .25);
      p.xz *= rot(s * 2.);
      p.y  += s * .25;
    }
  }

  void main(void) {
    vec2 uv = (
      gl_FragCoord.xy -.5 * resolution.xy
    ) / min(resolution.x, resolution.y);

    vec3 col = vec3(0),
    ro = vec3(0, 0, 0),
    rd = normalize(vec3(uv, 1));

    cam(ro);
    cam(rd);

    vec3 p = ro;

    const float steps = 25., maxd = 1.5;
    float dd = .0;

    for (float i = .0; i < steps; i++) {
      float d = map(p);

      if (d < 1e-3) {
        break;
      }

      if (dd > maxd) {
        dd = maxd;
        break;
      }

      p += rd * d;
      dd += d;
    }

    col += vol(p, rd, ro, dd);

    col = pow(col, vec3(.4545));
    col = S(.0, 1., col);
    col *= exp(-125e-5*dd*dd*dd);

    fragColor = vec4(col, 0.5);
  }`;

  /* ------------------------------------------------------------------
   * GL utilities
   * ------------------------------------------------------------------ */
  const compileShader = (type: GLenum, source: string): WebGLShader => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
  };

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram()!;
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
  }

  /* ------------------------------------------------------------------
   * Quad setup
   * ------------------------------------------------------------------ */
  const vertices = new Float32Array([
    -1, -1,
    1, -1,
    -1, 1,
    -1, 1,
    1, -1,
    1, 1,
  ]);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const uniformResolution = gl.getUniformLocation(program, "resolution");
  const uniformTime = gl.getUniformLocation(program, "time");
  const uniformTouch = gl.getUniformLocation(program, "touch");
  const uniformPointerCount = gl.getUniformLocation(program, "pointerCount");

  /* ------------------------------------------------------------------
   * Interaction
   * ------------------------------------------------------------------ */
  const mouse = {
    x: 0,
    y: 0,
    touches: new Set<number>(),
  };

  const updatePointer = (x: number, y: number, id: number) => {
    mouse.x = x * DPR;
    mouse.y = (window.innerHeight - y) * DPR;
    mouse.touches.add(id);
  };

  const removePointer = (id: number) => {
    mouse.touches.delete(id);
  };

  const onPointerDown = (e: PointerEvent) => updatePointer(e.clientX, e.clientY, e.pointerId);
  const onPointerUp = (e: PointerEvent) => removePointer(e.pointerId);
  const onPointerMove = (e: PointerEvent) => {
    if (mouse.touches.has(e.pointerId)) updatePointer(e.clientX, e.clientY, e.pointerId);
  };

  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointermove", onPointerMove);

  /* ------------------------------------------------------------------
   * Render loop
   * ------------------------------------------------------------------ */
  let rafId = 0;
  const render = (now: number) => {
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    gl.uniform2f(uniformResolution, canvas.width, canvas.height);
    gl.uniform1f(uniformTime, now * 1e-3);
    gl.uniform2f(uniformTouch, mouse.x, mouse.y);
    gl.uniform1i(uniformPointerCount, mouse.touches.size);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    rafId = requestAnimationFrame(render);
  };

  rafId = requestAnimationFrame(render);

  /* ------------------------------------------------------------------
   * disposer
   * ------------------------------------------------------------------ */
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointermove", onPointerMove);

    // Clean up WebGL resources
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    // Force context loss to reclaim GPU memory
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();

    if (container.contains(canvas)) container.removeChild(canvas);
  };
} 
