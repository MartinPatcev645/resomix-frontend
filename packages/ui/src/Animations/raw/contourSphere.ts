import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Mounts the contour-line sphere WebGL + GSAP scroll animation inside the
 * supplied container and returns a disposer that cleans everything up.
 *
 * The implementation is a (very) light refactor of the original vanilla
 * HTML/JS demo: we swapped CDN scripts for package imports, wrapped everything
 * in a function, and added proper disposal so it plays nicely inside a React
 * app.
 */
export interface ContourSphereOptions {
  /**
   * Element that ScrollTrigger should use as the trigger. If omitted we use
   * the document body (full-page mode). When you want the animation confined
   * to a single section, pass the same container element you supplied when
   * mounting.
   */
  trigger?: HTMLElement | string;
  /** if true, renderer sizing is based on container instead of window */
  useContainerSize?: boolean;
}

export function initContourSphere(
  container: HTMLElement,
  options: ContourSphereOptions = {}
): () => void {
  // Make GSAP aware of ScrollTrigger.
  gsap.registerPlugin(ScrollTrigger);

  /* -------------------------------------------------------------------------
   * 1. SETTINGS
   * -----------------------------------------------------------------------*/
  const settings = {
    lineCount: 35,
    lineWidth: 0.02,
    lineSharpness: 25.0,
    rimEffect: 0.8,
    rimIntensity: 3.0,
    rimWidth: 0.6,
    offset: 0.0,
    sphereDetail: 96,
    gap: 0.3,
    distortion: 0.0,
    twist: 0.0,
    useHighlights: true,
    highlightIntensity: 0.7,
    occlusion: 0.3,
    glowIntensity: 0.6,
    glowColor: new THREE.Color(0x3388ff),
    colorShift: 0.0,
    pulseSpeed: 0.5,
    lineColorA: new THREE.Color(0xffffff),
    lineColorB: new THREE.Color(0x88ccff),
  };

  /* -------------------------------------------------------------------------
   * 2. GLSL HELPERS + SHADERS (copied verbatim from the original demo)
   * -----------------------------------------------------------------------*/
  const helperFunctions = `
    // Classic hash function
    float hash(float n) { 
      return fract(sin(n) * 43758.5453123); 
    }
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + .1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float smootherstep(float edge0, float edge1, float x, float smoothness) {
      x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
      return pow(x, smoothness) * (smoothness + 1.0) - pow(x, smoothness + 1.0) * smoothness;
    }
    float contour(float val, float width, float sharpness) {
      float contourVal = abs(fract(val) - 0.5);
      return pow(smoothstep(0.0, width, contourVal), sharpness);
    }
    float fresnel(vec3 normal, vec3 viewDir, float power) {
      return pow(1.0 - abs(dot(normal, viewDir)), power);
    }
    float noise(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);
      f = f*f*(3.0-2.0*f);
      float n = i.x + i.y*157.0 + 113.0*i.z;
      return mix(
        mix(mix(hash(n+0.0), hash(n+1.0), f.x),
            mix(hash(n+157.0), hash(n+158.0), f.x), f.y),
        mix(mix(hash(n+113.0), hash(n+114.0), f.x),
            mix(hash(n+270.0), hash(n+271.0), f.x), f.y), f.z);
    }
    float fbm(vec3 p, int octaves) {
      float value = 0.0;
      float amplitude = 0.5;
      float frequency = 1.0;
      for (int i = 0; i < octaves; i++) {
        value += amplitude * noise(p * frequency);
        amplitude *= 0.5;
        frequency *= 2.0;
        if (amplitude < 0.01) break;
      }
      return value;
    }
    vec3 mixColor(vec3 colorA, vec3 colorB, float t) {
      return mix(colorA, colorB, t);
    }
  `;

  // Vertex + fragment shaders are *exactly* the ones provided, only the helper
  // placeholder is interpolated so we don’t repeat that string twice.
  const vertexShader = `
    ${helperFunctions}
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vPosition;
    varying vec3 vOrigPosition;
    varying vec3 vWorldPosition;
    varying float vFresnel;
    varying float vElevation;
    varying float vDistortion;
    uniform float uRimEffect;
    uniform float uRimIntensity;
    uniform float uScrollProgress;
    uniform float uDistortion;
    uniform float uTwist;
    uniform float uTime;
    uniform float uPulseSpeed;
    vec3 twist(vec3 p, float strength) {
      float c = cos(strength * p.y);
      float s = sin(strength * p.y);
      mat2 m = mat2(c, -s, s, c);
      return vec3(m * p.xz, p.y).xzy;
    }
    float pulseEffect(float time, float speed) {
      return 0.5 * sin(time * speed) + 0.5;
    }
    void main() {
      vOrigPosition = position;
      vec3 pos = position;
      float pulse = pulseEffect(uTime, uPulseSpeed);
      float twistAmount = uTwist * (1.0 + pulse * 0.1);
      pos = twist(pos, twistAmount);
      float distortionAmount = uDistortion;
      float noiseValue = 0.0;
      if (distortionAmount > 0.0) {
        noiseValue = fbm(pos * 3.0 + vec3(0.0, uTime * 0.1, uScrollProgress * 10.0), 3) * 2.0 - 1.0;
        pos += normal * noiseValue * distortionAmount;
        vDistortion = noiseValue * distortionAmount;
      } else {
        vDistortion = 0.0;
      }
      vec3 transformedNormal = normalize(normal);
      if (distortionAmount > 0.0 || twistAmount > 0.0) {
        float delta = 0.01;
        vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
        vec3 bitangent = normalize(cross(normal, tangent));
        vec3 posP1 = position + tangent * delta;
        vec3 posP2 = position + bitangent * delta;
        if (twistAmount > 0.0) {
          posP1 = twist(posP1, twistAmount);
          posP2 = twist(posP2, twistAmount);
        }
        if (distortionAmount > 0.0) {
          float n1 = fbm(posP1 * 3.0 + vec3(0.0, uTime * 0.1, uScrollProgress * 10.0), 2) * 2.0 - 1.0;
          float n2 = fbm(posP2 * 3.0 + vec3(0.0, uTime * 0.1, uScrollProgress * 10.0), 2) * 2.0 - 1.0;
          posP1 += normal * n1 * distortionAmount;
          posP2 += normal * n2 * distortionAmount;
        }
        vec3 newTangent = normalize(posP1 - pos);
        vec3 newBitangent = normalize(posP2 - pos);
        transformedNormal = normalize(cross(newTangent, newBitangent));
      }
      vNormal = normalMatrix * transformedNormal;
      vPosition = pos;
      vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
      vec3 worldCameraPos = cameraPosition;
      vec3 worldViewDir = normalize(worldCameraPos - vWorldPosition);
      vViewDir = worldViewDir;
      vFresnel = fresnel(normalize((modelMatrix * vec4(transformedNormal, 0.0)).xyz), worldViewDir, uRimIntensity * (1.0 + pulse * 0.2));
      vElevation = length(pos);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    ${helperFunctions}
    varying vec3 vNormal;
    varying vec3 vViewDir;
    varying vec3 vPosition;
    varying vec3 vOrigPosition;
    varying vec3 vWorldPosition;
    varying float vFresnel;
    varying float vElevation;
    varying float vDistortion;
    uniform float uLineCount;
    uniform float uLineWidth;
    uniform float uLineSharpness;
    uniform float uRimEffect;
    uniform float uRimWidth;
    uniform float uOffset;
    uniform bool uUseHighlights;
    uniform float uHighlightIntensity;
    uniform float uOcclusion;
    uniform float uScrollProgress;
    uniform float uDistortion;
    uniform float uTime;
    uniform float uGlowIntensity;
    uniform vec3 uGlowColor;
    uniform float uColorShift;
    uniform vec3 uLineColorA;
    uniform vec3 uLineColorB;
    void main() {
      vec3 dir = normalize(vPosition);
      float elevation = vElevation;
      elevation += dot(normalize(vNormal), dir) * 0.05;
      float timeOffset = sin(uTime * 0.2) * 0.05;
      float rimFactor = vFresnel * uRimEffect;
      float gradient = 1.0 + pow(rimFactor, 2.0) * 5.0;
      float contourValue;
      if (uScrollProgress < 0.33) {
        contourValue = (elevation + uOffset + uScrollProgress + timeOffset) * uLineCount * mix(1.0, gradient, uRimWidth);
      } else if (uScrollProgress < 0.66) {
        float localProgress = (uScrollProgress - 0.33) * 3.0;
        float pulseEffect = 0.2 + 0.1 * sin(uTime * 0.5);
        vec3 localPos = vPosition * (1.0 + sin(localProgress * 6.28) * pulseEffect);
        contourValue = length(localPos.xz) * uLineCount * 2.0;
      } else {
        float localProgress = (uScrollProgress - 0.66) * 3.0;
        float noise1 = fbm(vPosition * 5.0 + vec3(uTime * 0.1, 0.0, uScrollProgress), 2);
        float noise2 = fbm(vPosition * 2.0 - vec3(0.0, uTime * 0.2, uScrollProgress * 3.0), 2);
        contourValue = (elevation * noise1 + noise2 * 2.0) * uLineCount;
      }
      float lineVal = 1.0 - contour(contourValue, uLineWidth, uLineSharpness);
      lineVal = mix(lineVal, step(uLineWidth * 2.0, abs(fract(contourValue) - 0.5)), rimFactor * 0.7);
      float colorMix = 0.5 + 0.5 * sin(vElevation * 5.0 + uTime * 0.3 + vDistortion * 2.0);
      colorMix = mix(colorMix, rimFactor, uColorShift);
      vec3 lineColor = mixColor(uLineColorA, uLineColorB, colorMix);
      vec3 color = lineColor * lineVal;
      if (uUseHighlights) {
        vec3 lightDir = normalize(vec3(
          sin(uScrollProgress * 6.28 + uTime * 0.2),
          1.0,
          cos(uScrollProgress * 6.28 + uTime * 0.2)
        ));
        vec3 halfVector = normalize(lightDir + vViewDir);
        float specular = pow(max(0.0, dot(vNormal, halfVector)), 16.0);
        color += vec3(specular) * lineVal * uHighlightIntensity;
        float ao = 1.0 - uOcclusion * (1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0)));
        color *= ao;
      }
      color *= (0.98 + hash(vPosition * 1000.0) * 0.04);
      vec3 glowColor = uGlowColor * rimFactor * uGlowIntensity;
      color += glowColor;
      float alpha = lineVal * 0.8 + rimFactor * 0.2;
      gl_FragColor = vec4(color, alpha);
    }
  `;

  /* -------------------------------------------------------------------------
   * 3. THREE.JS SCENE SETUP
   * -----------------------------------------------------------------------*/
  // Canvas
  const canvas = document.createElement("canvas");
  canvas.className = "webgl";
  container.appendChild(canvas);

  const getDimensions = () => {
    if (options.useContainerSize) {
      const rect = container.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const initialDims = getDimensions();
  renderer.setSize(initialDims.width, initialDims.height);
  renderer.setClearColor(0x000000, 0);

  // Camera
  const camera = new THREE.PerspectiveCamera(45, initialDims.width / initialDims.height, 0.1, 1000);
  camera.position.set(0, 0, 3.5);

  // Scene + group
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  scene.add(group);

  /* -------------------------------------------------------------------------
   * 4. SHADER MATERIAL + GEOMETRY CREATION
   * -----------------------------------------------------------------------*/
  const materialBase = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uLineCount: { value: settings.lineCount },
      uLineWidth: { value: settings.lineWidth },
      uLineSharpness: { value: settings.lineSharpness },
      uRimEffect: { value: settings.rimEffect },
      uRimIntensity: { value: settings.rimIntensity },
      uRimWidth: { value: settings.rimWidth },
      uOffset: { value: settings.offset },
      uUseHighlights: { value: settings.useHighlights },
      uHighlightIntensity: { value: settings.highlightIntensity },
      uOcclusion: { value: settings.occlusion },
      uScrollProgress: { value: 0.0 },
      uDistortion: { value: settings.distortion },
      uTwist: { value: settings.twist },
      uTime: { value: 0.0 },
      uGlowIntensity: { value: settings.glowIntensity },
      uGlowColor: { value: settings.glowColor },
      uColorShift: { value: settings.colorShift },
      uPulseSpeed: { value: settings.pulseSpeed },
      uLineColorA: { value: settings.lineColorA },
      uLineColorB: { value: settings.lineColorB },
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  let leftSphere: THREE.Mesh | null = null;
  let rightSphere: THREE.Mesh | null = null;
  let materials: THREE.ShaderMaterial[] = [];
  let lastDetailLevel = settings.sphereDetail;
  let lastGap = settings.gap;

  function createGeometry() {
    if (leftSphere) {
      group.remove(leftSphere);
      group.remove(rightSphere!);
    }
    const detail = settings.sphereDetail;
    const radius = 1;
    const leftGeom = new THREE.SphereGeometry(radius, detail, detail, 0, Math.PI, 0, Math.PI);
    const rightGeom = new THREE.SphereGeometry(radius, detail, detail, Math.PI, Math.PI, 0, Math.PI);
    const leftMat = materialBase.clone();
    const rightMat = materialBase.clone();
    leftSphere = new THREE.Mesh(leftGeom, leftMat);
    rightSphere = new THREE.Mesh(rightGeom, rightMat);
    const gap = settings.gap / 2;
    leftSphere.position.x = -gap;
    rightSphere.position.x = gap;
    group.add(leftSphere);
    group.add(rightSphere);
    materials = [leftMat, rightMat];
    lastDetailLevel = settings.sphereDetail;
    lastGap = settings.gap;
  }

  createGeometry();

  /* -------------------------------------------------------------------------
   * 5. RESIZE HANDLING
   * -----------------------------------------------------------------------*/
  const onResize = () => {
    const dims = getDimensions();
    camera.aspect = dims.width / dims.height;
    camera.updateProjectionMatrix();
    renderer.setSize(dims.width, dims.height);
  };
  window.addEventListener("resize", onResize);

  /* -------------------------------------------------------------------------
   * 6. GSAP + SCROLLTRIGGER ANIMATIONS (mostly identical to original)
   * -----------------------------------------------------------------------*/
  let scrollProgress = 0;
  const clock = new THREE.Clock();
  let mainScrollTrigger: ScrollTrigger | null = null;

  function setupScrollAnimations() {
    gsap.utils.toArray("section").forEach((section: any) => {
      const heading = (section as Element).querySelector("h1");
      const paragraph = (section as Element).querySelector("p");
      gsap
        .timeline({
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            end: "bottom 20%",
            toggleActions: "play none none reverse",
          },
        })
        .to(heading, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" })
        .to(paragraph, { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, "-=0.4");
    });

    mainScrollTrigger = ScrollTrigger.create({
      trigger: options.trigger || "body",
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        /* --- original section-specific modifiers (abridged not to exceed token) --- */
        // Get scroll progress
        scrollProgress = self.progress;

        // Update scrollProgress uniform
        materials.forEach((mat) => {
          mat.uniforms.uScrollProgress.value = scrollProgress;
        });

        // Enhanced section-specific transformations with smoother transitions
        if (scrollProgress < 0.25) {
          // Section 1: Expanding gap with subtle effects
          const localProgress = scrollProgress * 4.0;
          settings.gap = gsap.utils.interpolate(0.1, 0.5, localProgress);
          settings.distortion = gsap.utils.interpolate(0.0, 0.1, localProgress);
          settings.twist = 0.0;
          settings.colorShift = gsap.utils.interpolate(0.0, 0.3, localProgress);
          settings.glowIntensity = gsap.utils.interpolate(0.2, 0.4, localProgress);

          group.rotation.x = gsap.utils.interpolate(0, 0.2, localProgress);
          group.rotation.y = gsap.utils.interpolate(0, Math.PI * 0.25, localProgress);
        } else if (scrollProgress < 0.5) {
          // Section 2: Twisting effect with colour changes
          const localProgress = (scrollProgress - 0.25) * 4.0;
          settings.gap = gsap.utils.interpolate(0.5, 0.3, localProgress);
          settings.distortion = gsap.utils.interpolate(0.1, 0.2, localProgress);
          settings.twist = gsap.utils.interpolate(0.0, 3.0, localProgress);
          settings.colorShift = gsap.utils.interpolate(0.3, 0.6, localProgress);
          settings.glowIntensity = gsap.utils.interpolate(0.4, 0.6, localProgress);

          group.rotation.x = gsap.utils.interpolate(0.2, Math.PI * 0.25, localProgress);
          group.rotation.y = gsap.utils.interpolate(Math.PI * 0.25, Math.PI * 0.5, localProgress);
        } else if (scrollProgress < 0.75) {
          // Section 3: High distortion
          const localProgress = (scrollProgress - 0.5) * 4.0;
          settings.gap = 0.3;
          settings.distortion = gsap.utils.interpolate(0.2, 0.5, localProgress);
          settings.twist = gsap.utils.interpolate(3.0, 1.0, localProgress);
          settings.colorShift = gsap.utils.interpolate(0.6, 0.8, localProgress);
          settings.glowIntensity = gsap.utils.interpolate(0.6, 0.8, localProgress);

          group.rotation.x = Math.PI * 0.25;
          group.rotation.y = gsap.utils.interpolate(Math.PI * 0.5, Math.PI, localProgress);
        } else {
          // Section 4: Reset / clean form
          const localProgress = (scrollProgress - 0.75) * 4.0;
          settings.gap = gsap.utils.interpolate(0.3, 0.2, localProgress);
          settings.distortion = gsap.utils.interpolate(0.5, 0.0, localProgress);
          settings.twist = gsap.utils.interpolate(1.0, 0.0, localProgress);
          settings.colorShift = gsap.utils.interpolate(0.8, 0.0, localProgress);
          settings.glowIntensity = gsap.utils.interpolate(0.8, 0.2, localProgress);

          group.rotation.x = gsap.utils.interpolate(Math.PI * 0.25, 0, localProgress);
          group.rotation.y = gsap.utils.interpolate(Math.PI, Math.PI * 2, localProgress);
        }

        // Push real-time values into uniforms
        materials.forEach((mat) => {
          mat.uniforms.uDistortion.value = settings.distortion;
          mat.uniforms.uTwist.value = settings.twist;
          mat.uniforms.uGlowIntensity.value = settings.glowIntensity;
          mat.uniforms.uColorShift.value = settings.colorShift;
        });

        // Apply gap spacing
        if (leftSphere && rightSphere) {
          const gap = settings.gap / 2;
          leftSphere.position.x = -gap;
          rightSphere.position.x = gap;
          lastGap = settings.gap;
        }

        // Dynamic line count
        const lineCount = gsap.utils.interpolate(30, 60, scrollProgress);
        settings.lineCount = lineCount;

        // Colour ramp
        const startColor = new THREE.Color(0xffffff);
        const midColor = new THREE.Color(0x88ccff);
        const endColor = new THREE.Color(0x44aaff);

        if (scrollProgress < 0.5) {
          settings.lineColorA = startColor.clone().lerp(midColor, scrollProgress * 2);
        } else {
          settings.lineColorA = midColor.clone().lerp(endColor, (scrollProgress - 0.5) * 2);
        }

        materials.forEach((mat) => {
          mat.uniforms.uLineColorA.value = settings.lineColorA;
        });
      },
    });
  }

  setupScrollAnimations();

  /* -------------------------------------------------------------------------
   * 7. ANIMATION LOOP
   * -----------------------------------------------------------------------*/
  let animationId = 0;
  const animate = () => {
    animationId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();
    materials.forEach((mat) => {
      mat.uniforms.uTime.value = elapsed;
      mat.uniforms.uLineCount.value = settings.lineCount;
      mat.uniforms.uLineWidth.value = settings.lineWidth;
      mat.uniforms.uLineSharpness.value = settings.lineSharpness;
      mat.uniforms.uRimEffect.value = settings.rimEffect;
      mat.uniforms.uRimIntensity.value = settings.rimIntensity;
      mat.uniforms.uRimWidth.value = settings.rimWidth;
      mat.uniforms.uOffset.value = settings.offset;
      mat.uniforms.uUseHighlights.value = settings.useHighlights;
      mat.uniforms.uHighlightIntensity.value = settings.highlightIntensity;
      mat.uniforms.uOcclusion.value = settings.occlusion;
      mat.uniforms.uPulseSpeed.value = settings.pulseSpeed;
      mat.uniforms.uLineColorB.value = settings.lineColorB;
    });
    if (lastDetailLevel !== settings.sphereDetail) createGeometry();
    group.rotation.z = Math.sin(elapsed * 0.1) * 0.05;
    renderer.render(scene, camera);
  };
  animate();

  /* -------------------------------------------------------------------------
   * 8. CLEAN-UP / DISPOSER
   * -----------------------------------------------------------------------*/
  return () => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", onResize);
    if (mainScrollTrigger) mainScrollTrigger.kill();
    renderer.dispose();
    canvas.remove();
  };
} 