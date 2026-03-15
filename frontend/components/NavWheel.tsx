"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, AlertTriangle, Search, Globe, FileText } from "lucide-react";
import Image from "next/image";

export type WheelFeature = "fraud" | "anomaly" | "sanctions" | "georisk" | "reports";

interface NavWheelProps {
  protectionScore: number;
  openWindows: Set<WheelFeature>;
  onOpen: (id: WheelFeature) => void;
}

const FEATURES: {
  id: WheelFeature;
  label: string;
  icon: React.ReactNode;
  angleDeg: number;
}[] = [
  { id: "fraud",     label: "Fraud",     icon: <Shield className="h-5 w-5" />,       angleDeg: 270 },
  { id: "anomaly",   label: "Anomaly",   icon: <AlertTriangle className="h-5 w-5" />, angleDeg: 342 },
  { id: "sanctions", label: "Sanctions", icon: <Search className="h-5 w-5" />,        angleDeg: 54  },
  { id: "georisk",   label: "Geo Risk",  icon: <Globe className="h-5 w-5" />,         angleDeg: 126 },
  { id: "reports",   label: "Reports",   icon: <FileText className="h-5 w-5" />,      angleDeg: 198 },
];

const ORBIT_RADIUS = 96;
const HUB_SIZE = 88;
const BTN_W = 52;
const BTN_H = 52;

function deg2rad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function NavWheel({ protectionScore, openWindows, onOpen }: NavWheelProps) {
  const [hovered, setHovered] = useState<WheelFeature | null>(null);

  const totalSize = HUB_SIZE + ORBIT_RADIUS * 2 + BTN_H;
  const center = totalSize / 2;

  return (
    <div style={{ width: totalSize, height: totalSize, position: "relative" }}>
      {/* Rotating dashed orbit ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <svg width={totalSize} height={totalSize} style={{ position: "absolute", inset: 0 }}>
          <circle
            cx={center} cy={center}
            r={ORBIT_RADIUS + BTN_H / 2}
            fill="none"
            stroke="rgba(0,0,0,0.1)"
            strokeWidth="1"
            strokeDasharray="3 7"
          />
        </svg>
      </motion.div>

      {/* Feature buttons */}
      {FEATURES.map((feat) => {
        const rad = deg2rad(feat.angleDeg);
        const x = center + Math.cos(rad) * ORBIT_RADIUS - BTN_W / 2;
        const y = center + Math.sin(rad) * ORBIT_RADIUS - BTN_H / 2;
        const isOpen = openWindows.has(feat.id);
        const isHovered = hovered === feat.id;

        return (
          <div key={feat.id} style={{ position: "absolute", left: x, top: y }}>
            {/* Tooltip */}
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.1 }}
                  style={{
                    position: "absolute",
                    bottom: BTN_H + 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-satoshi)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "white",
                    background: "#111",
                    borderRadius: 4,
                    padding: "3px 8px",
                    pointerEvents: "none",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  {feat.label}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
              onHoverStart={() => setHovered(feat.id)}
              onHoverEnd={() => setHovered(null)}
              onClick={() => onOpen(feat.id)}
              style={{
                width: BTN_W,
                height: BTN_H,
                borderRadius: 10,
                background: isOpen ? "#111" : "white",
                color: isOpen ? "white" : "#111",
                border: `2px solid ${isOpen ? "#111" : "rgba(0,0,0,0.15)"}`,
                boxShadow: isOpen
                  ? "0 4px 16px rgba(0,0,0,0.3)"
                  : "0 2px 8px rgba(0,0,0,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
              }}
            >
              {feat.icon}
            </motion.button>
          </div>
        );
      })}

      {/* Hub */}
      <div
        style={{
          position: "absolute",
          left: center - HUB_SIZE / 2,
          top: center - HUB_SIZE / 2,
          width: HUB_SIZE,
          height: HUB_SIZE,
          borderRadius: 16,
          background: "#111",
          boxShadow: "0 6px 28px rgba(0,0,0,0.32)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
        }}
      >
        <Image src="/yosemite_logo.png" alt="yosemite" width={28} height={28} className="rounded-md opacity-90" />
        <span
          style={{
            fontFamily: "var(--font-space-grotesk)",
            fontSize: 12,
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.02em",
          }}
        >
          {protectionScore}%
        </span>
      </div>
    </div>
  );
}
