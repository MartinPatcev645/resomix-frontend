/* eslint-disable @typescript-eslint/ban-ts-comment */
// terrain.ts – Perlin-noise terrain with sombrero pulse
// No React imports here. This is a *raw* helper like initRemains / initStarfield.

import * as THREE from "three";
import ResizeObserver from "resize-observer-polyfill";

/**
 * Public options you can tweak from the React component.
 */
export interface TerrainOptions {
  speed: number;
  segments: number;
  perlinPasses: number;
  elevation: number;
  noiseRange: number;
  sombreroAmplitude: number;
  sombreroFrequency: number;
  wireframe: boolean;
  wireframeColor: number | string;
  floorVisible: boolean;
}

const DEFAULTS: TerrainOptions = {
  speed: 0.8,
  segments: 324,
  perlinPasses: 1,
  elevation: 1,
  noiseRange: 2.14,
  sombreroAmplitude: 0.6,
  sombreroFrequency: 10,
  wireframe: true,
  wireframeColor: "#e25cfe",
  floorVisible: true,
};

/**
 * Bootstraps the terrain WebGL animation inside the given container.
 * Returns a disposer you MUST call on unmount.
 */
export function initTerrain(
  container: HTMLElement,
  options: Partial<TerrainOptions> = {}
): () => void {
  const opts = { ...DEFAULTS, ...options } as TerrainOptions;

  /* ------------------------------------------------------------
   * 1. canvas + renderer bound to the container (not <body>)
   * ---------------------------------------------------------- */
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block"; // tailwind resets inherit
  container.appendChild(canvas);

  let width = container.clientWidth;
  let height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
  renderer.setSize(width, height);
  // Render with transparent background so underlying content can show through
  renderer.setClearColor(0x000000, 0);

  /* ------------------------------------------------------------
   * 2. basic THREE scene / camera / light
   * ---------------------------------------------------------- */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 1, 7);
  camera.lookAt(0, 0, 0);

  const light = new THREE.DirectionalLight(0xffffff, 0.8);
  light.position.set(5, 10, 7);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x404040));

  /* ------------------------------------------------------------
   * 3. geometry + materials (shader + optional ground)
   * ---------------------------------------------------------- */
  const planeGeometry = new THREE.PlaneGeometry(20, 20, opts.segments, opts.segments);

  const uniforms = {
    time: { value: 0 },
    speed: { value: opts.speed },
    elevation: { value: opts.elevation },
    noise_range: { value: opts.noiseRange },
    perlin_passes: { value: opts.perlinPasses },
    sombrero_amplitude: { value: opts.sombreroAmplitude },
    sombrero_frequency: { value: opts.sombreroFrequency },
    line_color: { value: new THREE.Color(opts.wireframeColor as any) },
  } as Record<string, THREE.IUniform>;

  // prettier-ignore
  const vertexShader = `
    varying vec2  v_uv;
    varying vec3  v_line_color;
    
    uniform float time;
    uniform float speed;
    uniform float elevation;
    uniform float noise_range;
    uniform float perlin_passes;
    uniform float sombrero_amplitude;
    uniform float sombrero_frequency;
    uniform vec3  line_color;
    varying float z;

    // --- utility functions (same as legacy) ------------------
    vec3 mod289(vec3 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}  
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
    vec3 fade(vec3 t){return t*t*t*(t*(t*6.0-15.0)+10.0);}  

    float pnoise(vec3 P, vec3 rep){
      vec3 Pi0 = mod(floor(P), rep);
      vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;
      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);
      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);
      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);
      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
      vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000), dot(g010,g010), dot(g100,g100), dot(g110,g110)));
      g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001), dot(g011,g011), dot(g101,g101), dot(g111,g111)));
      g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);
      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    #define M_PI 3.1415926535897932384626433832795

    void main() {
      gl_PointSize = 1.0;
      v_uv = uv;
      v_line_color = line_color;

      // --- Perlin based displacement -------------------------
      float displacement = pnoise(0.4 * position + vec3(0.0, speed * time, 0.0), vec3(100.0)) * 1.0 * noise_range;
      if (perlin_passes > 2.0) {
        displacement += pnoise(2.0 * position + vec3(0.0, speed * time * 5.0, 0.0), vec3(100.0)) * 0.3 * noise_range;
        displacement += pnoise(8.0 * position + vec3(0.0, speed * time * 20.0, 0.0), vec3(100.0)) * 0.1 * noise_range;
      } else if (perlin_passes > 1.0) {
        displacement += pnoise(8.0 * position + vec3(0.0, speed * time * 20.0, 0.0), vec3(100.0)) * 0.1 * noise_range;
      }

      // sombrero ripple ---------------------------------------
      float distance = sqrt(((uv.x - 0.5)*(uv.x - 0.5)) + ((uv.y - 0.5)*(uv.y - 0.5)));
      displacement += sombrero_amplitude * sin(((time * 0.5 * speed) - (distance * sombrero_frequency)) * M_PI);

      // sinus ridge -------------------------------------------
      displacement += sin(position.x / 2.0 - M_PI / 2.0) * elevation;

      vec3 newPosition = vec3(position.x, position.y, displacement);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      z = newPosition.z;
    }
  `;

  // prettier-ignore
  const fragmentShader = `
    varying vec2 v_uv;
    varying vec3 v_line_color;
    varying float z;
    #define M_PI 3.1415926535897932384626433832795
    void main() {
      float alpha = sin(v_uv.y * M_PI) / 4.0;
      gl_FragColor = vec4(v_line_color, alpha);
    }
  `;

  const planeMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    wireframe: opts.wireframe,
    transparent: true,
  });

  const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
  planeMesh.rotation.x = -Math.PI / 2;
  planeMesh.position.y = -0.5;
  scene.add(planeMesh);

  if (opts.floorVisible) {
    const groundMat = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x050505 });
    groundMat.color.setHSL(0.095, 1, 0.75);
    const ground = new THREE.Mesh(planeGeometry, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    scene.add(ground);
  }

  /* ------------------------------------------------------------
   * 4. animation loop
   * ---------------------------------------------------------- */
  const clock = new THREE.Clock();
  let rafId = 0;
  const animate = () => {
    uniforms.time.value = clock.getElapsedTime();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };
  animate();

  /* ------------------------------------------------------------
   * 5. resize bound to container
   * ---------------------------------------------------------- */
  const ro = new ResizeObserver(() => {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  /* ------------------------------------------------------------
   * 6. disposer for React unmount
   * ---------------------------------------------------------- */
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    renderer.dispose();
    container.removeChild(canvas);
  };
} 