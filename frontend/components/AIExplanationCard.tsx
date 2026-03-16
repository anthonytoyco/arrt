"use client";

import { useState } from "react";

interface AIExplanationCardProps {
  explanation: string;
  label?: string;
}

export function AIExplanationCard({ explanation, label = "AI explanation" }: AIExplanationCardProps) {
  const [open, setOpen] = useState(false);

  if (!explanation?.trim()) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 uppercase tracking-wider transition-colors"
      >
        {open ? "Hide" : "Show"} {label}
        <span>{open ? "—" : "+"}</span>
      </button>
      {open && (
        <div className="mt-2 p-3 border border-border text-xs text-foreground/70 leading-relaxed">
          {explanation}
        </div>
      )}
    </div>
  );
}
