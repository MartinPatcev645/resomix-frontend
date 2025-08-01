import * as THREE from "three";

/**
 * Initializes the fractal-orb shader animation inside the given container.
 * Returns a disposer you MUST call on unmount.
 */
export function initFractalOrb(container: HTMLElement): () => void {
  // ---------------------------------------------------------------------
  // Canvas / renderer tied to the container
  // ---------------------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
  container.appendChild(renderer.domElement);

  // ---------------------------------------------------------------------
  // Scene setup
  // ---------------------------------------------------------------------
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  // Uniform defaults (mirroring original JS)
  const uniforms: { [key: string]: THREE.IUniform } = {
    iResolution: { value: new THREE.Vector2(width, height) },
    iTime: { value: 0.0 },
    smoothedMouse: { value: new THREE.Vector2(0, 0) },
    mouseDown: { value: 0.0 },
    primaryColor: { value: new THREE.Color(1, 1, 1) },
    secondaryColor: { value: new THREE.Color(1, 1, 1) },
    accentColor: { value: new THREE.Color(0, 0, 0) },
    fractalScale: { value: 0.3 },
    fractalOffset: { value: new THREE.Vector2(0, 0) },
    lightCount: { value: 1 },
    lightIntensity: { value: 1.0 },
    lightSpeed: { value: 1.0 },
    grainStrength: { value: 0.15 },
    grainSize: { value: 3.5 },
    animationSpeed: { value: 0.02 },
    autoRotate: { value: 1.0 },
  } as const;

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  const fragmentShader = /* glsl */`
    varying vec2 vUv;
    uniform vec2 iResolution;
    uniform float iTime;
    uniform vec3 primaryColor;
    uniform vec3 secondaryColor;
    uniform vec3 accentColor;
    uniform vec2 smoothedMouse;
    uniform float mouseDown;
    uniform float fractalScale;
    uniform vec2 fractalOffset;
    uniform int lightCount;
    uniform float lightIntensity;
    uniform float lightSpeed;
    uniform float grainStrength;
    uniform float grainSize;
    uniform float animationSpeed;
    uniform float autoRotate;

    #define PI 3.14159265359

    // Improved noise function
    float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    float hash(float n) {
        return fract(sin(n) * 43758.5453);
    }

    // Rotation matrix
    mat2 rot(float a) {
        float s = sin(a);
        float c = cos(a);
        return mat2(c, -s, s, c);
    }

    float udCos(vec2 p, float a, float b, float c, float d) {
        p = c * (p - vec2(d, a));
        float w = c * b;

        const float TPI = 6.28318530718;
        p.x = mod(p.x, TPI);
        if (p.x > 0.5 * TPI) p.x = TPI - p.x;

        float xa = 0.0, xb = TPI / 2.0;
        for (int i = 0; i < 24; i++) {
            float x = 0.5 * (xa + xb);
            float y = x - p.x + w * sin(x) * (p.y - w * cos(x));
            if (y < 0.0) xa = x; else xb = x;
        }

        vec2 qa = vec2(xa, w * cos(xa));
        vec2 qb = vec2(xb, w * cos(xb));
        vec2 pa = p - qa, ba = qb - qa;
        float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
        float r = length(pa - ba * h);
        return r / c;
    }

    float smoothMax(float a, float b, float k) {
        return log(exp(k * a) + exp(k * b)) / k;
    }

    float logoShape(vec2 uv, float time) {
        uv = (uv * 2.0 - 1.0);
        uv.x *= iResolution.x / iResolution.y;

        uv *= fractalScale;
        uv += fractalOffset;

        float d = length(uv);
        float pulse = 0.5 + 0.025 * sin(time * animationSpeed * 2.0);
        float shape = smoothstep(pulse, pulse - 0.025, d);
        float innerGlow = smoothstep(pulse * 0.8, 0.0, d) * 0.5;

        float baseThickness = 0.1;
        float sharpness = 5.0;
        float waveFreq = 3.5;
        float phase = -PI;
        float range = 0.3;
        float totalWave = 0.0;
        for (int i = 0; i < 5; i++) {
            float amp = 0.05;
            float sign = 1.0;
            if (i == 0) { amp = 0.1; sign = -1.0; }
            else if (i == 1) { amp = 0.05; sign = -1.0; }
            else if (i == 2) { amp = 0.1; sign = 1.0; }
            else if (i == 3) { amp = 0.05; sign = 1.0; }
            else if (i == 4) { amp = 0.0; sign = 1.0; }

            float yOffset = -amp * sign;
            float dist = udCos(uv, yOffset + 0.01, amp * sign, PI * waveFreq, 0.0);

            float blurRadius = baseThickness;
            float waveLine = pow(1.0 - smoothstep(0.0, blurRadius, dist), 15.0);

            float edgeFade = 0.04;
            float xMask = smoothstep(-range, -range + edgeFade, uv.x) * (1.0 - smoothstep(range - edgeFade, range, uv.x));

            float contribution = waveLine * xMask;

            totalWave = smoothMax(totalWave, contribution, sharpness);
        }
        totalWave /= 4.0;

        return shape + totalWave;
    }

    vec3 getLightPosition(int index, float time) {
        float angle = float(index) * (2.0 * PI / float(lightCount)) + time * lightSpeed;
        float radius = 1.5;
        float height = sin(time * lightSpeed * 0.5 + float(index)) * 0.5;
        return vec3(radius * cos(angle), height, radius * sin(angle));
    }

    float calculateLight(vec2 uv, float time) {
        vec3 pos = vec3(uv.x, uv.y, 0.0);
        float totalLight = 0.0;
        for (int i = 0; i < 10; i++) {
            if (i >= lightCount) break;
            vec3 lightPos = getLightPosition(i, time);
            float dist = length(pos - lightPos);
            totalLight += lightIntensity / (1.0 + dist * dist * 2.0);
        }
        vec2 mousePos = smoothedMouse / iResolution.xy;
        mousePos = (mousePos * 2.0 - 1.0);
        mousePos.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mousePos);
        totalLight += lightIntensity * 2.0 / (1.0 + mouseDist * mouseDist * 4.0);
        return totalLight;
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        vec2 centeredUV = (uv * 2.0 - 1.0);
        centeredUV.x *= iResolution.x / iResolution.y;

        float shape = logoShape(uv, iTime);
        float light = calculateLight(centeredUV, iTime);

        vec3 baseColor = mix(primaryColor, secondaryColor, shape);
        float highlight = pow(shape, 3.0);
        baseColor = mix(baseColor, accentColor, highlight * 0.5);
        baseColor *= light * (shape + 0.2);

        vec2 uvRandom = vUv;
        uvRandom.y *= hash(vec2(uvRandom.y, iTime * 0.01));
        float noise = hash(uvRandom * grainSize + iTime * 0.1) * grainStrength;
        baseColor += noise - grainStrength * 0.5;

        gl_FragColor = vec4(baseColor, 1.0);
    }
  `;

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as { [uniform: string]: THREE.IUniform },
    vertexShader,
    fragmentShader,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(plane);

  // ---------------------------------------------------------------------
  // Mouse handling (global to window)
  // ---------------------------------------------------------------------
  const rawMouse = new THREE.Vector2();
  const smoothedMouse = uniforms.smoothedMouse.value;

  const onMove = (e: MouseEvent) => {
    const rect = container.getBoundingClientRect();
    const localX = (e.clientX - rect.left) / rect.width;
    const localY = 1 - (e.clientY - rect.top) / rect.height; // flip y
    rawMouse.set(localX, localY);
  };
  window.addEventListener("mousemove", onMove);

  const onDown = () => {
    uniforms.mouseDown.value = 1.0;
  };
  const onUp = () => {
    uniforms.mouseDown.value = 0.0;
  };
  window.addEventListener("mousedown", onDown);
  window.addEventListener("mouseup", onUp);

  // Resize observer to keep canvas in sync with container
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    uniforms.iResolution.value.set(w, h);
  });
  ro.observe(container);

  let rafId = 0;
  const animate = () => {
    const t = performance.now() * 0.001;
    uniforms.iTime.value = t;
    // smooth mouse
    smoothedMouse.lerp(
      new THREE.Vector2(
        rawMouse.x * uniforms.iResolution.value.x,
        rawMouse.y * uniforms.iResolution.value.y
      ),
      0.1
    );

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };
  animate();

  // ---------------------------------------------------------------------
  // disposer
  // ---------------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mousedown", onDown);
    window.removeEventListener("mouseup", onUp);
    renderer.dispose();
    if (container.contains(renderer.domElement))
      container.removeChild(renderer.domElement);
  };
} 