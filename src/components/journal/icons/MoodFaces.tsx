import React from "react";
import { cn } from "@/lib/utils";

export type MoodValue = 1 | 2 | 3 | 4 | 5;

const palette: Record<MoodValue, string> = {
  1: "#ef4444", // red - awful
  2: "#f97316", // orange - bad
  3: "#eab308", // yellow - meh
  4: "#10b981", // teal/emerald - good
  5: "#22c55e", // green - rad
};

export const moodLabels: Record<MoodValue, string> = {
  1: "awful",
  2: "bad",
  3: "meh",
  4: "good",
  5: "rad",
};

export function MoodFace({ value, active = false, size = 52, className }: { value: MoodValue; active?: boolean; size?: number; className?: string }) {
  const color = palette[value];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;

  // Eye positions
  const eyeY = cy - size * 0.12;
  const eyeXOff = size * 0.15;

  // Mouth positions
  const mouthY = cy + size * 0.1;
  const mouthWidth = size * 0.22;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("transition-all duration-200", className)}
    >
      {/* White circle background with colored border */}
      <circle 
        cx={cx} 
        cy={cy} 
        r={r} 
        fill="white"
        stroke={color}
        strokeWidth={active ? 3 : 2.5}
        className="transition-all duration-200"
      />

      {/* Eyes based on mood */}
      {value === 1 ? (
        // X X eyes for awful
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <path d={`M ${cx - eyeXOff - 3} ${eyeY - 3} L ${cx - eyeXOff + 3} ${eyeY + 3}`} />
          <path d={`M ${cx - eyeXOff + 3} ${eyeY - 3} L ${cx - eyeXOff - 3} ${eyeY + 3}`} />
          <path d={`M ${cx + eyeXOff - 3} ${eyeY - 3} L ${cx + eyeXOff + 3} ${eyeY + 3}`} />
          <path d={`M ${cx + eyeXOff + 3} ${eyeY - 3} L ${cx + eyeXOff - 3} ${eyeY + 3}`} />
        </g>
      ) : value === 2 ? (
        // Horizontal line eyes for bad
        <g stroke={color} strokeWidth={2.5} strokeLinecap="round">
          <line x1={cx - eyeXOff - 4} y1={eyeY} x2={cx - eyeXOff + 4} y2={eyeY} />
          <line x1={cx + eyeXOff - 4} y1={eyeY} x2={cx + eyeXOff + 4} y2={eyeY} />
        </g>
      ) : value === 5 ? (
        // Happy curved eyes for rad
        <g stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round">
          <path d={`M ${cx - eyeXOff - 4} ${eyeY} Q ${cx - eyeXOff} ${eyeY + 3} ${cx - eyeXOff + 4} ${eyeY}`} />
          <path d={`M ${cx + eyeXOff - 4} ${eyeY} Q ${cx + eyeXOff} ${eyeY + 3} ${cx + eyeXOff + 4} ${eyeY}`} />
        </g>
      ) : (
        // Dot eyes for meh and good
        <>
          <circle cx={cx - eyeXOff} cy={eyeY} r={3} fill={color} />
          <circle cx={cx + eyeXOff} cy={eyeY} r={3} fill={color} />
        </>
      )}

      {/* Mouth based on mood */}
      {value === 1 ? (
        // Deep frown for awful
        <path 
          d={`M ${cx - mouthWidth} ${mouthY + 6} Q ${cx} ${mouthY - 4} ${cx + mouthWidth} ${mouthY + 6}`} 
          stroke={color} 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : value === 2 ? (
        // Slight frown for bad
        <path 
          d={`M ${cx - mouthWidth} ${mouthY + 3} Q ${cx} ${mouthY - 2} ${cx + mouthWidth} ${mouthY + 3}`} 
          stroke={color} 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : value === 3 ? (
        // Flat line for meh
        <line 
          x1={cx - mouthWidth} 
          y1={mouthY} 
          x2={cx + mouthWidth} 
          y2={mouthY} 
          stroke={color} 
          strokeWidth={2.5} 
          strokeLinecap="round"
        />
      ) : value === 4 ? (
        // Smile for good
        <path 
          d={`M ${cx - mouthWidth} ${mouthY - 2} Q ${cx} ${mouthY + 5} ${cx + mouthWidth} ${mouthY - 2}`} 
          stroke={color} 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      ) : (
        // Big smile for rad
        <path 
          d={`M ${cx - mouthWidth} ${mouthY - 3} Q ${cx} ${mouthY + 7} ${cx + mouthWidth} ${mouthY - 3}`} 
          stroke={color} 
          strokeWidth={2.5} 
          fill="none" 
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
