"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface HolographicReactorProps {
  cognitiveState?: string;
  isListening?: boolean;
  isSpeaking?: boolean;
  audioLevel?: number;
  speechLevel?: number;
  scale?: number;
  intensity?: number;
  spin?: number;
  style?: "ring" | "sphere" | "wire";
  accentColor?: string;
  orbitItems?: Array<{ id?: string; url: string; title?: string }>;
  reducedMotion?: boolean;
}

const STATE_COLORS: Record<string, string> = {
  OFFLINE: "#475569",
  BOOT: "#00f0ff",
  DORMANT: "#1e3a8a",
  WAKING: "#38bdf8",
  LISTENING: "#00f0ff",
  THINKING: "#a855f7",
  PLANNING: "#c084fc",
  TOOLING: "#f59e0b",
  EXECUTING: "#f59e0b",
  SPEAKING: "#10b981",
  ERROR: "#ef4444",
  MISSION: "#14b8a6",
  VISION: "#8b5cf6",
  CONFIRMATION: "#f97316",
  IDLE: "#00f0ff"
};

export default function HolographicReactor({
  cognitiveState = "IDLE",
  isListening = false,
  isSpeaking = false,
  audioLevel = 0,
  speechLevel = 0,
  scale = 1.0,
  intensity = 1.0,
  spin = 1.0,
  style = "ring",
  accentColor,
  orbitItems = [],
  reducedMotion = false
}: HolographicReactorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const coreMeshRef = useRef<THREE.Mesh | null>(null);
  const ring1Ref = useRef<THREE.LineSegments | null>(null);
  const ring2Ref = useRef<THREE.LineSegments | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const orbitGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number>(0);

  // Compute active target color
  const targetColorStr = accentColor || (isSpeaking ? STATE_COLORS.SPEAKING : (isListening ? STATE_COLORS.LISTENING : (STATE_COLORS[cognitiveState.toUpperCase()] || STATE_COLORS.IDLE)));
  const targetColor = new THREE.Color(targetColorStr);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene & Camera
    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.5;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (e) {
      console.warn("WebGL initialization unavailable:", e);
      return;
    }

    // 1. Central Core Geometry
    const coreGeo = new THREE.IcosahedronGeometry(0.85, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: targetColor,
      wireframe: style === 'wire',
      transparent: true,
      opacity: style === 'wire' ? 0.6 : 0.85
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);
    coreMeshRef.current = coreMesh;

    // 2. Inner Ring 1
    const ring1Geo = new THREE.RingGeometry(1.15, 1.22, 48);
    const ring1Edges = new THREE.EdgesGeometry(ring1Geo);
    const ring1Mat = new THREE.LineBasicMaterial({ color: targetColor, transparent: true, opacity: 0.75 });
    const ring1 = new THREE.LineSegments(ring1Edges, ring1Mat);
    scene.add(ring1);
    ring1Ref.current = ring1;

    // 3. Outer Segmented Ring 2
    const ring2Geo = new THREE.RingGeometry(1.35, 1.45, 32);
    const ring2Edges = new THREE.EdgesGeometry(ring2Geo);
    const ring2Mat = new THREE.LineBasicMaterial({ color: targetColor, transparent: true, opacity: 0.5 });
    const ring2 = new THREE.LineSegments(ring2Edges, ring2Mat);
    scene.add(ring2);
    ring2Ref.current = ring2;

    // 4. Energy Particle Dust Field
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 0.9 + Math.random() * 1.2;
      particlePos[i] = Math.cos(theta) * radius;
      particlePos[i + 1] = Math.sin(theta) * radius;
      particlePos[i + 2] = (Math.random() - 0.5) * 0.8;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      size: 0.04,
      color: targetColor,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // 5. Orbiting Asset Group
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    orbitGroupRef.current = orbitGroup;

    // Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Audio reactivity modulation
      const effectiveAudio = isSpeaking ? speechLevel : (isListening ? audioLevel : 0);
      const audioPulse = 1 + (effectiveAudio / 100) * 0.25;

      const motionFactor = reducedMotion ? 0.2 : 1.0;
      const rotationSpeed = spin * motionFactor;

      if (coreMeshRef.current) {
        coreMeshRef.current.rotation.x += delta * 0.4 * rotationSpeed;
        coreMeshRef.current.rotation.y += delta * 0.6 * rotationSpeed;
        const currentScale = scale * audioPulse;
        coreMeshRef.current.scale.set(currentScale, currentScale, currentScale);
        (coreMeshRef.current.material as THREE.MeshBasicMaterial).color.lerp(targetColor, delta * 3);
      }

      if (ring1Ref.current) {
        ring1Ref.current.rotation.z += delta * 0.8 * rotationSpeed;
        (ring1Ref.current.material as THREE.LineBasicMaterial).color.lerp(targetColor, delta * 3);
      }

      if (ring2Ref.current) {
        ring2Ref.current.rotation.z -= delta * 0.5 * rotationSpeed;
        (ring2Ref.current.material as THREE.LineBasicMaterial).color.lerp(targetColor, delta * 3);
      }

      if (particlesRef.current) {
        particlesRef.current.rotation.z += delta * 0.2 * rotationSpeed;
        (particlesRef.current.material as THREE.PointsMaterial).color.lerp(targetColor, delta * 3);
      }

      if (orbitGroupRef.current) {
        orbitGroupRef.current.rotation.y += delta * 0.3 * rotationSpeed;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animFrameIdRef.current);
      if (renderer) {
        renderer.dispose();
        if (container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
        }
      }
    };
  }, [style]);

  return (
    <div className="relative flex items-center justify-center w-72 h-72 md:w-96 md:h-96 select-none">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
