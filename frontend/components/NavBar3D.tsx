"use client";

import { useRef, useState, Suspense } from "react";

import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

export type NavFeature = "fraud" | "anomaly" | "sanctions" | "georisk" | "reports";

interface NavBar3DProps {
  protectionScore: number;
  openWindows: Set<NavFeature>;
  onOpen: (id: NavFeature) => void;
}

const FEATURES: { id: NavFeature; label: string }[] = [
  { id: "fraud",     label: "Fraud" },
  { id: "anomaly",   label: "Anomaly" },
  { id: "sanctions", label: "Sanctions" },
  { id: "georisk",   label: "Geo Risk" },
  { id: "reports",   label: "Reports" },
];

const SPACING = 2.4;
const N = FEATURES.length;

// ── Single spinning cube ────────────────────────────────────────────────────

function NavCube({
  index, isOpen, isHovered, label, onClick, onHoverStart, onHoverEnd,
}: {
  index: number;
  isOpen: boolean;
  isHovered: boolean;
  label: string;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const targetSpeed = isHovered ? 2.4 : isOpen ? 1.2 : 0.4;
  const speedRef = useRef(0.4);

  useFrame((_, delta) => {
    speedRef.current += (targetSpeed - speedRef.current) * 0.08;
    ref.current.rotation.y += delta * speedRef.current;
    ref.current.rotation.x += delta * speedRef.current * 0.3;
  });

  const x = (index - (N - 1) / 2) * SPACING;

  return (
    <group position={[x, 0, 0]}>
      <mesh
        ref={ref}
        onClick={onClick}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; onHoverStart(); }}
        onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = "auto"; onHoverEnd(); }}
      >
        <boxGeometry args={[1.0, 1.0, 1.0]} />
        <meshStandardMaterial
          color={isOpen ? "#ffffff" : "#111111"}
          metalness={0.7}
          roughness={0.2}
          emissive={isOpen ? "#cccccc" : "#000000"}
          emissiveIntensity={isOpen ? 0.2 : 0}
        />
      </mesh>
      {/* Always-visible label */}
      <Html position={[0, -1.15, 0]} center style={{ pointerEvents: "none" }}>
        <div style={{
          whiteSpace: "nowrap",
          fontFamily: "var(--font-satoshi)",
          fontSize: 11,
          fontWeight: 600,
          color: isHovered ? "#111" : "#999",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          transition: "color 0.15s",
        }}>
          {label}
        </div>
      </Html>
    </group>
  );
}

function Scene({
  openWindows, hovered, onOpen, onHoverChange,
}: {
  openWindows: Set<NavFeature>;
  hovered: NavFeature | null;
  onOpen: (id: NavFeature) => void;
  onHoverChange: (id: NavFeature | null) => void;
}) {
  return (
    <>
      <ambientLight intensity={1.0} />
      <directionalLight position={[3, 6, 4]} intensity={1.6} />
      <directionalLight position={[-3, 2, -3]} intensity={0.5} />
      <pointLight position={[0, 4, 2]} intensity={0.4} color="#ffffff" />
      {FEATURES.map((feat, i) => (
        <NavCube
          key={feat.id}
          index={i}
          isOpen={openWindows.has(feat.id)}
          isHovered={hovered === feat.id}
          label={feat.label}
          onClick={(e) => { e.stopPropagation(); onOpen(feat.id); }}
          onHoverStart={() => onHoverChange(feat.id)}
          onHoverEnd={() => onHoverChange(null)}
        />
      ))}
    </>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function NavBar3D({ openWindows, onOpen }: NavBar3DProps) {
  const [hovered, setHovered] = useState<NavFeature | null>(null);

  const CANVAS_W = N * 140;
  const CANVAS_H = 130;

  return (
    <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H }}>
      <Canvas
        style={{ width: CANVAS_W, height: CANVAS_H }}
        camera={{ position: [0, 0, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <Scene
            openWindows={openWindows}
            hovered={hovered}
            onOpen={onOpen}
            onHoverChange={setHovered}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
