import React from "react";

// Allow any string id to support custom user tags
export type TagId = string;

const emojiMap: Record<string, string> = {
  family: "👨‍👩‍👧",
  friends: "👯",
  date: "❤️",
  exercise: "🏋️",
  sport: "🏆",
  relax: "😌",
  movies: "🎬",
  gaming: "🎮",
  reading: "📖",
  cleaning: "✨",
  shower: "🚿",
  sleep: "🌙",
  eat_healthy: "🥗",
  shopping: "🛒",
  study: "📚",
  work: "💼",
  music: "🎵",
  meditation: "🧘",
  nature: "🌳",
  travel: "✈️",
  cooking: "🍳",
  walk: "👟",
  socialize: "💬",
  coffee: "☕",
  prayer: "🙏",
  love: "❤️",
  romance: "💕",
  spouse: "💑",
};

// Intelligent custom tag emoji mapping
const customTagEmojis: Record<string, string> = {
  wife: "👰",
  husband: "🤵",
  partner: "💑",
  kids: "👶",
  children: "👨‍👩‍👧‍👦",
  pet: "🐾",
  dog: "🐕",
  cat: "🐈",
  baby: "👶",
  gym: "💪",
  health: "❤️‍🩹",
  car: "🚗",
  bike: "🚴",
  run: "🏃",
  swim: "🏊",
  yoga: "🧘‍♀️",
};

export function TagIcon({ id, className }: { id: string; className?: string }) {
  const emoji = emojiMap[id] || customTagEmojis[id] || "🏷️";
  return <span className={className}>{emoji}</span>;
}
