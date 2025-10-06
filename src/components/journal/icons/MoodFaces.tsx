import React from "react";

export type MoodValue = 1 | 2 | 3 | 4 | 5;

const palette: Record<MoodValue, { stroke: string; fill: string }> = {
  1: { stroke: "#ef4444", fill: "#fee2e2" }, // red
  2: { stroke: "#f97316", fill: "#ffedd5" }, // orange
  3: { stroke: "#f59e0b", fill: "#fef3c7" }, // amber
  4: { stroke: "#10b981", fill: "#d1fae5" }, // emerald
  5: { stroke: "#22c55e", fill: "#dcfce7" }, // green
};

export const moodLabels: Record<MoodValue, string> = {
  1: "awful",
  2: "bad",
  3: "meh",
  4: "good",
  5: "rad",
};

export function MoodFace({ value, active = false, size = 52 }: { value: MoodValue; active?: boolean; size?: number }) {
  const { stroke, fill } = palette[value];
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;

  // Mouth shape per mood
  const mouth = (() => {
    const y = cy + size * 0.12;
    const w = size * 0.26;
    if (value === 1) return `M ${cx - w} ${y + 6} Q ${cx} ${y - 8} ${cx + w} ${y + 6}`; // frown
    if (value === 2) return `M ${cx - w} ${y + 2} Q ${cx} ${y - 4} ${cx + w} ${y + 2}`; // slight frown
    if (value === 3) return `M ${cx - w} ${y} L ${cx + w} ${y}`; // flat
    if (value === 4) return `M ${cx - w} ${y} Q ${cx} ${y + 8} ${cx + w} ${y}`; // smile
    return `M ${cx - w} ${y - 2} Q ${cx} ${y + 10} ${cx + w} ${y - 2}`; // big smile
  })();

  // Eye positions
  const eyeY = cy - size * 0.08;
  const eyeXOff = size * 0.14;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={active ? "drop-shadow-[0_8px_18px_rgba(236,72,153,0.35)]" : undefined}>
      <defs>
        <radialGradient id={`g-${stroke.replace('#','')}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={fill} stopOpacity="0.9" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id={`gloss-${stroke.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Face base - no stroke ring */}
      <circle cx={cx} cy={cy} r={r} fill={`url(#g-${stroke.replace('#','')})`} stroke="none" />
      {/* Gloss highlight (top arc) */}
      <path d={`M ${cx - r + 6} ${cy - r + 10} A ${r - 6} ${r - 10} 0 0 1 ${cx + r - 6} ${cy - r + 10}`} stroke={`url(#gloss-${stroke.replace('#','')})`} strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx={cx - eyeXOff} cy={eyeY} r={size * 0.04} fill={stroke} />
      <circle cx={cx + eyeXOff} cy={eyeY} r={size * 0.04} fill={stroke} />
      <path d={mouth} stroke={stroke} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
