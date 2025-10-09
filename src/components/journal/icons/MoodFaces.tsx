import React from "react";
import { cn } from "@/lib/utils";

export type MoodValue = 1 | 2 | 3 | 4 | 5;

const moodEmoji: Record<MoodValue, string> = {
  1: "😖", // awful
  2: "🙁", // bad
  3: "😐", // meh
  4: "🙂", // good
  5: "😄", // rad
};

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
  const emoji = moodEmoji[value];
  const color = palette[value];

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full bg-white transition-all duration-200",
        active ? "ring-2 scale-105" : "ring-2 ring-transparent",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.6,
        borderWidth: active ? 3 : 2,
        borderStyle: "solid",
        borderColor: color,
      }}
    >
      {emoji}
    </div>
  );
}
