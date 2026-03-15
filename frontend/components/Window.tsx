"use client";

import { useRef } from "react";
import { motion } from "framer-motion";

interface WindowProps {
  id: string;
  title: string;
  defaultPosition: { x: number; y: number };
  zIndex: number;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  children: React.ReactNode;
  width?: number;
}

export function Window({
  id,
  title,
  defaultPosition,
  zIndex,
  onClose,
  onFocus,
  children,
  width = 480,
}: WindowProps) {
  const constraintsRef = useRef(null);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      initial={{ opacity: 0, scale: 0.88, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.88, y: 16, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      style={{
        position: "fixed",
        left: "50%",
        top: "50%",
        x: defaultPosition.x,
        y: defaultPosition.y,
        zIndex,
        width,
      }}
      onMouseDown={() => onFocus(id)}
      className="rounded-2xl overflow-hidden shadow-window bg-white border border-gray-200/80 select-none"
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200/80 cursor-grab active:cursor-grabbing"
        style={{ fontFamily: "var(--font-space-grotesk)" }}
      >
        {/* macOS-style dots */}
        <button
          onClick={() => onClose(id)}
          className="h-3 w-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors flex-shrink-0"
        />
        <div className="h-3 w-3 rounded-full bg-yellow-400 flex-shrink-0" />
        <div className="h-3 w-3 rounded-full bg-green-400 flex-shrink-0" />
        <span className="ml-2 text-[13px] font-semibold text-gray-600 tracking-tight">
          {title}
        </span>
      </div>

      {/* Content */}
      <div className="overflow-auto max-h-[70vh]">
        {children}
      </div>
    </motion.div>
  );
}
