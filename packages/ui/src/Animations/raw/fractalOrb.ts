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
    fractalScale: { value: 1.0 },
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
    varying   vec2  vUv;
    uniform   vec2  iResolution;
    uniform   float iTime;
    uniform   vec3  primaryColor;
    uniform   vec3  secondaryColor;
    uniform   vec3  accentColor;
    uniform   vec2  smoothedMouse;
    uniform   float mouseDown;
    uniform   float fractalScale;
    uniform   vec2  fractalOffset;
    uniform   int   lightCount;
    uniform   float lightIntensity;
    uniform   float lightSpeed;
    uniform   float grainStrength;
    uniform   float grainSize;
    uniform   float animationSpeed;
    uniform   float autoRotate;

    #define PI 3.14159265359

    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    mat2  rot(float a){ float s = sin(a), c = cos(a); return mat2(c,-s,s,c); }

    float lineSDF(vec2 p, vec2 a, vec2 b, float w){ vec2 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa - ba*h) - w; }

    float starShape(vec2 uv){
      vec2 p = uv*2.0 - 1.0;
      p.x *= iResolution.x / iResolution.y;
      p  = p*fractalScale + fractalOffset;

      float spokeMask = 0.0;
      float spokeLen  = 1.2;
      float halfW     = 0.025;
      for(int i=0;i<8;i++){
        float a = PI*0.25*float(i);
        vec2 dir = vec2(cos(a), sin(a));
        float d = lineSDF(p, vec2(0.0), dir*spokeLen, halfW);
        spokeMask = max(spokeMask, 1.0 - smoothstep(0.0, 0.02, d));
      }

      vec2 dir = normalize(vec2( 1.0,  1.0));
      float r  = 0.11;
      float d1 = length(p - dir*0.7) - r;
      float d2 = length(p + dir*0.7) - r;
      float caps = 1.0 - smoothstep(0.0, 0.02, min(d1,d2));

      return pow(max(spokeMask, caps), 0.8);
    }

    vec3 lightPos(int i, float t){ float a=float(i)*(2.0*PI/float(lightCount))+t*lightSpeed; return vec3(1.5*cos(a), sin(t*lightSpeed*0.5+float(i))*0.5, 1.5*sin(a)); }
    float accumulateLights(vec2 p, float t){ vec3 pos=vec3(p,0.0); float L=0.0; for(int i=0;i<10;i++){ if(i>=lightCount) break; vec3 lp=lightPos(i,t); float d=length(pos-lp); L+=lightIntensity/(1.0+d*d*2.0);} vec2 m=(smoothedMouse/iResolution.xy)*2.0-1.0; m.x*=iResolution.x/iResolution.y; float md=length(p-m); L+=lightIntensity*2.0/(1.0+md*md*4.0); return L; }

    void main(){
      vec2 uv = gl_FragCoord.xy / iResolution.xy;
      vec2 p  = uv*2.0 - 1.0; p.x *= iResolution.x / iResolution.y;

      float shape = starShape(uv);
      float L     = accumulateLights(p, iTime);

      vec3 col = mix(primaryColor, secondaryColor, shape);
      col      = mix(col, accentColor, pow(shape,3.0)*0.5);
      col     *= L * (shape + 0.2);

      vec2 nUV = vUv; nUV.y *= hash(vec2(nUV.y, iTime*0.01));
      float n = hash(nUV*grainSize + iTime*0.1) * grainStrength;
      col += n - grainStrength*0.5;

      gl_FragColor = vec4(col, 1.0);
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
    smoothedMouse.lerp(rawMouse.clone().multiplyScalar(width), 0.1);

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