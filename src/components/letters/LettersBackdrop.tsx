import React from 'react';

const EN = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const AR = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","ه","و","ي"];

const COLORS = [
  "#6366F1", // indigo-500
  "#8B5CF6", // violet-500
  "#EC4899", // pink-500
  "#F59E0B", // amber-500
  "#10B981", // emerald-500
  "#06B6D4", // cyan-500
  "#3B82F6", // blue-500
];

export function LettersBackdrop({ density = 24 }: { density?: number }) {
  const letters = React.useMemo(() => {
    const pool = [...EN, ...AR];
    const arr: { ch: string; left: number; top: number; rot: number; opacity: number; size: number; color: string }[] = [];
    for (let i = 0; i < density; i++) {
      const ch = pool[(i * 7) % pool.length];
      const left = ((i * 37) % 100) + Math.random() * 3 - 1.5;
      const top = ((i * 53) % 100) + Math.random() * 3 - 1.5;
      const rot = (i * 19) % 360;
      const opacity = 0.24 + ((i * 11) % 20) / 250; // stronger visibility ~0.24–0.32
      const size = 28 + ((i * 13) % 40); // larger range
      const color = COLORS[i % COLORS.length];
      arr.push({ ch, left, top, rot, opacity, size, color });
    }
    return arr;
  }, [density]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/40 via-white/30 to-emerald-50/40 dark:from-indigo-900/20 dark:via-transparent dark:to-emerald-900/20" />
      {letters.map((l, idx) => (
        <span
          key={idx}
          className="select-none font-extrabold"
          style={{
            position: 'absolute',
            left: `${l.left}%`,
            top: `${l.top}%`,
            transform: `translate(-50%, -50%) rotate(${l.rot}deg)`,
            opacity: l.opacity,
            fontSize: `${l.size}px`,
            color: l.color,
            filter: 'drop-shadow(0 1.5px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 1px rgba(255,255,255,0.25))'
          }}
        >
          {l.ch}
        </span>
      ))}

      <div className="absolute -inset-10 blur-3xl opacity-35">
        <div className="absolute left-1/4 top-1/4 h-48 w-48 rounded-full bg-gradient-to-tr from-indigo-400/40 to-purple-400/40" />
        <div className="absolute right-1/4 bottom-1/4 h-56 w-56 rounded-full bg-gradient-to-tr from-emerald-400/40 to-teal-400/40" />
      </div>
    </div>
  );
}

export default LettersBackdrop;
