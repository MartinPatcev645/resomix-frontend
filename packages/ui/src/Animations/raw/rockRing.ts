// -----------------------------------------------------------------------------
// NOTE: This file was generated from the original plain-JS demo that rendered
// a ring of GLTF rock meshes. All heavyweight bitmap / GLB payloads have been
// replaced with trivial placeholders so the file compiles out-of-the-box. The
// caller (or the design team) should later swap the `placeholder*` constants
// with the real base-64 (or URL) strings that point to the actual assets.
// -----------------------------------------------------------------------------

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
// Raw base-64 payloads – Vite's `?raw` query keeps them as strings
// @ts-ignore – Vite raw import provides string at runtime
import rocksDiffuseB64 from "./assets/rocksDiffuse?raw";
// @ts-ignore
import rocksRoughnessB64 from "./assets/rocksRoughness?raw";
// @ts-ignore
import rocksNormalsB64 from "./assets/rocksNormals?raw";
// @ts-ignore
import rocksBufferB64 from "./assets/rocksBuffer?raw";

declare const anime: any;

/**
 * Initializes the rotating-rocks shader animation inside the given container.
 * Returns a disposer you MUST call on unmount.
 */
export function initRockRing(container: HTMLElement): () => void {
  // ------------------------------------------------------------
  // Canvas / renderer tied to the container
  // ------------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio > 1 ? 2 : 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // ------------------------------------------------------------
  // Scene & camera
  // ------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#000", 20, 1000);

  const camera = new THREE.PerspectiveCamera(40, width / height, 1, 2000);
  camera.position.set(208, 180, 477);
  camera.lookAt(scene.position);
  scene.add(camera);

  // ------------------------------------------------------------
  // Lighting
  // ------------------------------------------------------------
  const parameters = {
    spacing: 1.1,
    rotationSpeed: 0.0002,
    radius: 150,
    sunlight: {
      color: "#ffffff",
      intensity: 1,
      position: { x: 0, y: 2, z: 0 },
    },
    fog: { color: "#eee", intensity: 0.1 },
    amountOfRocks: 6,
    pointLight: {
      color: "#eee",
      intensity: 3,
      position: { x: 50, y: 0, z: 200 },
      showHelper: false,
    },
  } as const;

  const sunLight = new THREE.DirectionalLight(
    parameters.sunlight.color,
    parameters.sunlight.intensity
  );
  sunLight.position.set(
    parameters.sunlight.position.x,
    parameters.sunlight.position.y,
    parameters.sunlight.position.z
  );
  sunLight.castShadow = true;
  scene.add(sunLight);

  const pointLight = new THREE.PointLight(
    parameters.pointLight.color,
    parameters.pointLight.intensity,
    100,
    0.1
  );
  pointLight.position.set(
    parameters.pointLight.position.x,
    parameters.pointLight.position.y,
    parameters.pointLight.position.z
  );
  pointLight.castShadow = true;
  scene.add(pointLight);

  // ------------------------------------------------------------
  // Textures (placeholder) & material
  // ------------------------------------------------------------
  const textureLoader = new THREE.TextureLoader();

  // -----------------------------------------------------------------
  // Rock textures loaded from separate files (exact names preserved)
  // -----------------------------------------------------------------
  const rockTexture = {
    rocksDiffuse: textureLoader.load(rocksDiffuseB64.trim()),
    rocksRoughness: textureLoader.load(rocksRoughnessB64.trim()),
    rocksNormals: textureLoader.load(rocksNormalsB64.trim()),
  } as const;

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    map: rockTexture.rocksDiffuse,
    roughnessMap: rockTexture.rocksRoughness,
    normalMap: rockTexture.rocksNormals,
  });

  // ------------------------------------------------------------
  // Rock geometry & meshes
  // ------------------------------------------------------------
  const RADIUS = parameters.radius;
  const ROCK_COUNT = parameters.amountOfRocks;
  const rocksGroup = new THREE.Group();
  scene.add(rocksGroup);

  // ------------------------------------------------------------
  // rockGLTF JSON – we keep the same structure but inject the buffer string
  // from ./assets/rocksBuffer
  // ------------------------------------------------------------

  const rockGLTF = {
    asset: {
      generator: "ResomiX glTF Blender I/O v3.6.27",
      version: "2.0",
    },
    scene: 0,
    scenes: [
      {
        name: "Scene",
        nodes: [0],
      },
    ],
    nodes: [
      {
        mesh: 0,
        name: "Aset_nature_rock_M_vecsbidqx_LOD1",
        scale: [
          0.0007145549170672894,
          0.0007145549170672894,
          0.0007145549170672894,
        ],
        translation: [
          0.004565401002764702,
          -0.007696971297264099,
          0.020041069015860558,
        ],
      },
    ],
    meshes: [
      {
        name: "Aset_nature_rock_M_vecsbidqx_LOD1",
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1,
              TEXCOORD_0: 2,
            },
            indices: 3,
          },
        ],
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3953,
        max: [37.52388000488281, 24.263507843017578, 27.915075302124023],
        min: [-32.36649703979492, -24.46312713623047, -22.23086166381836],
        type: "VEC3",
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 3953,
        type: "VEC3",
      },
      {
        bufferView: 2,
        componentType: 5126,
        count: 3953,
        type: "VEC2",
      },
      {
        bufferView: 3,
        componentType: 5123,
        count: 22086,
        type: "SCALAR",
      },
    ],
    bufferViews: [
      {
        buffer: 0,
        byteLength: 47436,
        byteOffset: 0,
        target: 34962,
      },
      {
        buffer: 0,
        byteLength: 47436,
        byteOffset: 47436,
        target: 34962,
      },
      {
        buffer: 0,
        byteLength: 31624,
        byteOffset: 94872,
        target: 34962,
      },
      {
        buffer: 0,
        byteLength: 44172,
        byteOffset: 126496,
        target: 34963,
      },
    ],
    buffers: [
      {
        byteLength: 170668,
        uri: rocksBufferB64.trim(),
      },
    ],
  } as any; // make mutable for URI patch

  // GLTF loader instance
  const loader = new GLTFLoader();

  const buildRocks = (geometry: THREE.BufferGeometry) => {
    for (let i = 0; i < ROCK_COUNT; i++) {
      const angle = (i / ROCK_COUNT) * Math.PI * 2;
      const x = RADIUS * Math.cos(angle);
      const z = RADIUS * Math.sin(angle);
      const mesh = new THREE.Mesh(geometry, rockMaterial);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(x, 0, z);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI,
        Math.random() * Math.PI * 0.5
      );
      rocksGroup.add(mesh);
    }
  };

  if (rockGLTF) {
    loader.parse(
      JSON.stringify(rockGLTF),
      "/",
      (gltf: any) => {
        const child = gltf.scene.children[0] as THREE.Mesh;
        buildRocks(child.geometry);
      },
      (error: unknown) => {
        console.error("Failed to parse rock GLTF:", error);
        buildRocks(new THREE.IcosahedronGeometry(5, 1));
      }
    );
  } else {
    // Fall-back simple geometry so demo runs without external asset.
    buildRocks(new THREE.IcosahedronGeometry(5, 1));
  }

  // ------------------------------------------------------------
  // Pointer tracking for point light
  // ------------------------------------------------------------
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  const onPointerMove = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  window.addEventListener("pointermove", onPointerMove);

  // ------------------------------------------------------------
  // Resize observer – keep canvas in sync
  // ------------------------------------------------------------
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  ro.observe(container);

  // ------------------------------------------------------------
  // Animation loop
  // ------------------------------------------------------------
  const rotationSpeed = parameters.rotationSpeed;
  let rafId = 0;
  const animate = () => {
    // Rotate individual rocks
    rocksGroup.children.forEach((child) => {
      child.rotation.x += rotationSpeed * 60;
      child.rotation.y += rotationSpeed * 60;
      child.rotation.z += rotationSpeed * 60;
    });

    // Spin whole ring
    rocksGroup.rotation.y += rotationSpeed * 120;

    // Move point light to cursor (project plane at z=0)
    raycaster.setFromCamera(pointer, camera);
    const vector = new THREE.Vector3(pointer.x, pointer.y, 0.5);
    vector.unproject(camera);
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const pos = camera.position.clone().add(dir.multiplyScalar(distance));
    pointLight.position.set(pos.x, pos.y, pos.z);

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };
  animate();

  // ------------------------------------------------------------
  // Orbit controls (optional ‑ mirrors original demo)
  // ------------------------------------------------------------
  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.enableZoom = true;
  orbitControls.enablePan = true;

  // ------------------------------------------------------------
  // Glowing button hover effect (copied from original)
  // ------------------------------------------------------------
  const normalizeRange = (
    value: number,
    originalMin: number,
    originalMax: number,
    newMin: number,
    newMax: number
  ) => {
    const originalRange = originalMax - originalMin;
    const newRange = newMax - newMin;
    return ((value - originalMin) * newRange) / originalRange + newMin;
  };

  const initGlowingButton = (button: HTMLElement) => {
    const normalizedLocalCursorPos = { x: 0, y: 0 };
    const glowElements = button.querySelectorAll<HTMLElement>(
      ".GlowingButton__glowWrap span"
    );
    const rect = button.getBoundingClientRect();
    const buttonWidth = button.clientWidth;
    const buttonHeight = button.clientHeight;

    button.addEventListener("mousemove", (e) => {
      normalizedLocalCursorPos.x = normalizeRange(
        e.clientX - rect.left,
        0,
        buttonWidth,
        -20,
        20
      );
      normalizedLocalCursorPos.y = normalizeRange(
        e.clientY - rect.top,
        0,
        buttonHeight,
        -7,
        7
      );
      if (typeof anime === "function") {
        anime({
          targets: glowElements,
          translateX: `${normalizedLocalCursorPos.x}`,
          translateY: `${normalizedLocalCursorPos.y}`,
        });
      }
    });

    button.addEventListener("mouseleave", () => {
      if (typeof anime === "function") {
        anime({ targets: glowElements, translateX: 0, translateY: 0 });
      }
    });
  };

  document
    .querySelectorAll<HTMLElement>(".GlowingButton")
    .forEach((btn) => initGlowingButton(btn));

  // ------------------------------------------------------------
  // Disposer
  // ------------------------------------------------------------
  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    renderer.dispose();
    if (container.contains(renderer.domElement)) {
      container.removeChild(renderer.domElement);
    }
  };
}
