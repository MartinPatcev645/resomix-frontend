import React, { useRef, useEffect } from "react";
import * as THREE from "three";

export const BlocksAnimation: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    mountRef.current.appendChild(renderer.domElement);

    // Create stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsCount = 1000;
    const positions = new Float32Array(starsCount * 3);
    const colors = new Float32Array(starsCount * 3);

    for (let i = 0; i < starsCount * 3; i += 3) {
      // Random positions in a sphere
      const radius = 100;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);

      // Random colors (white to blue)
      const color = new THREE.Color();
      color.setHSL(0.6, 0.8, Math.random() * 0.5 + 0.5);
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starsMaterial = new THREE.PointsMaterial({
      size: 0.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);

    // Create nebula-like particles
    const nebulaGeometry = new THREE.BufferGeometry();
    const nebulaCount = 200;
    const nebulaPositions = new Float32Array(nebulaCount * 3);
    const nebulaColors = new Float32Array(nebulaCount * 3);

    for (let i = 0; i < nebulaCount * 3; i += 3) {
      nebulaPositions[i] = (Math.random() - 0.5) * 200;
      nebulaPositions[i + 1] = (Math.random() - 0.5) * 200;
      nebulaPositions[i + 2] = (Math.random() - 0.5) * 200;

      // Purple to pink colors
      const color = new THREE.Color();
      color.setHSL(0.8 + Math.random() * 0.2, 0.7, 0.5 + Math.random() * 0.3);
      nebulaColors[i] = color.r;
      nebulaColors[i + 1] = color.g;
      nebulaColors[i + 2] = color.b;
    }

    nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3));
    nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3));

    const nebulaMaterial = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    });

    const nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
    scene.add(nebula);

    // Position camera
    camera.position.z = 5;

    // Animation variables
    let time = 0;
    const starSpeeds: number[] = [];
    const nebulaSpeeds: number[] = [];

    // Initialize speeds
    for (let i = 0; i < starsCount; i++) {
      starSpeeds.push(Math.random() * 0.5 + 0.1);
    }
    for (let i = 0; i < nebulaCount; i++) {
      nebulaSpeeds.push(Math.random() * 0.3 + 0.05);
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      time += 0.01;

      // Animate stars (flying through space effect)
      const starPositions = stars.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < starsCount; i++) {
        const index = i * 3;
        starPositions[index + 2] -= starSpeeds[i];
        
        // Reset stars that go too far
        if (starPositions[index + 2] < -50) {
          starPositions[index + 2] = 50;
        }
      }
      stars.geometry.attributes.position.needsUpdate = true;

      // Animate nebula
      const nebulaPositions = nebula.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < nebulaCount; i++) {
        const index = i * 3;
        nebulaPositions[index + 2] -= nebulaSpeeds[i];
        
        // Reset nebula particles
        if (nebulaPositions[index + 2] < -100) {
          nebulaPositions[index + 2] = 100;
        }
      }
      nebula.geometry.attributes.position.needsUpdate = true;

      // Rotate nebula slowly
      nebula.rotation.y += 0.001;
      nebula.rotation.x += 0.0005;

      // Camera movement (subtle)
      camera.position.x = Math.sin(time * 0.5) * 0.5;
      camera.position.y = Math.cos(time * 0.3) * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={mountRef} 
      className="w-full h-full"
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)' }}
    />
  );
};
