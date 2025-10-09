import React from "react";
import { cn } from "@/lib/utils";

export type MoodValue = 1 | 2 | 3 | 4 | 5;

const palette: Record<MoodValue, { base: string; glow: string }> = {
  1: { base: "#ef4444", glow: "#fca5a5" }, // red
  2: { base: "#f97316", glow: "#fdba74" }, // orange
  3: { base: "#eab308", glow: "#fde047" }, // yellow
  4: { base: "#10b981", glow: "#6ee7b7" }, // emerald
  5: { base: "#22c55e", glow: "#86efac" }, // green
};

export const moodLabels: Record<MoodValue, string> = {
  1: "awful",
  2: "bad",
  3: "meh",
  4: "good",
  5: "rad",
};

export function MoodFace({ value, active = false, size = 52, className }: { value: MoodValue; active?: boolean; size?: number; className?: string }) {
  const { base, glow } = palette[value];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 3;

  // Eye positions
  const eyeY = cy - size * 0.1;
  const eyeXOff = size * 0.16;
  const eyeSize = size * 0.08;

  // Mouth positions and shapes
  const mouthY = cy + size * 0.15;
  const mouthWidth = size * 0.3;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("transition-all duration-200", active ? "drop-shadow-lg scale-105" : "drop-shadow-sm", className)}
    >
      <defs>
        <linearGradient id={`grad-${value}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={glow} />
          <stop offset="100%" stopColor={base} />
        </linearGradient>
        <filter id={`glow-${value}`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Face circle with gradient */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={r} 
        fill={`url(#grad-${value})`}
        stroke="white"
        strokeWidth={active ? 3 : 2}
        filter={active ? `url(#glow-${value})` : undefined}
        className="transition-all duration-200"
      />

      {/* Eyes */}
      {value === 1 ? (
        // X eyes for awful
        <g stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <path d={`M ${cx - eyeXOff - 3} ${eyeY - 3} L ${cx - eyeXOff + 3} ${eyeY + 3}`} />
          <path d={`M ${cx - eyeXOff + 3} ${eyeY - 3} L ${cx - eyeXOff - 3} ${eyeY + 3}`} />
          <path d={`M ${cx + eyeXOff - 3} ${eyeY - 3} L ${cx + eyeXOff + 3} ${eyeY + 3}`} />
          <path d={`M ${cx + eyeXOff + 3} ${eyeY - 3} L ${cx + eyeXOff - 3} ${eyeY + 3}`} />
        </g>
      ) : value === 5 ? (
        // Happy closed eyes (curved lines)
        <g stroke="white" strokeWidth={2.5} fill="none" strokeLinecap="round">
          <path d={`M ${cx - eyeXOff - 4} ${eyeY - 1} Q ${cx - eyeXOff} ${eyeY + 3} ${cx - eyeXOff + 4} ${eyeY - 1}`} />
          <path d={`M ${cx + eyeXOff - 4} ${eyeY - 1} Q ${cx + eyeXOff} ${eyeY + 3} ${cx + eyeXOff + 4} ${eyeY - 1}`} />
        </g>
      ) : (
        // Regular dot eyes
        <>
          <circle cx={cx - eyeXOff} cy={eyeY} r={eyeSize} fill="white" />
          <circle cx={cx + eyeXOff} cy={eyeY} r={eyeSize} fill="white" />
        </>
      )}

      {/* Mouth */}
      {value === 1 ? (
        // Deep frown
        <path 
          d={`M ${cx - mouthWidth} ${mouthY + 4} Q ${cx} ${mouthY - 6} ${cx + mouthWidth} ${mouthY + 4}`} 
          stroke="white" 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : value === 2 ? (
        // Slight frown
        <path 
          d={`M ${cx - mouthWidth} ${mouthY + 2} Q ${cx} ${mouthY - 3} ${cx + mouthWidth} ${mouthY + 2}`} 
          stroke="white" 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : value === 3 ? (
        // Flat line
        <line 
          x1={cx - mouthWidth} 
          y1={mouthY} 
          x2={cx + mouthWidth} 
          y2={mouthY} 
          stroke="white" 
          strokeWidth={2.5} 
          strokeLinecap="round"
        />
      ) : value === 4 ? (
        // Smile
        <path 
          d={`M ${cx - mouthWidth} ${mouthY - 2} Q ${cx} ${mouthY + 6} ${cx + mouthWidth} ${mouthY - 2}`} 
          stroke="white" 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : (
        // Big smile
        <path 
          d={`M ${cx - mouthWidth} ${mouthY - 3} Q ${cx} ${mouthY + 8} ${cx + mouthWidth} ${mouthY - 3}`} 
          stroke="white" 
          strokeWidth={3} 
          fill="none" 
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
