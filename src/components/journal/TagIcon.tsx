import React from "react";
import {
  Users, UserRound, Heart, Dumbbell, Trophy, Cloud, Clapperboard, Gamepad2,
  BookOpen, Sparkles, Moon, Apple, ShoppingCart, GraduationCap, Briefcase,
  Music, Wind, TreeDeciduous, Plane, Utensils, Footprints, Handshake, Coffee
} from "lucide-react";

// Allow any string id to support custom user tags
export type TagId = string;

const map: Record<string, React.ComponentType<any>> = {
  family: Users,
  friends: UserRound,
  date: Heart,
  exercise: Dumbbell,
  sport: Trophy,
  relax: Cloud,
  movies: Clapperboard,
  gaming: Gamepad2,
  reading: BookOpen,
  cleaning: Sparkles,
  sleep: Moon,
  eat_healthy: Apple,
  shopping: ShoppingCart,
  study: GraduationCap,
  work: Briefcase,
  music: Music,
  meditation: Wind,
  nature: TreeDeciduous,
  travel: Plane,
  cooking: Utensils,
  walk: Footprints,
  socialize: Handshake,
  coffee: Coffee,
};

export function TagIcon({ id, className }: { id: string; className?: string }) {
  const Cmp = (map as Record<string, React.ComponentType<any>>)[id] || Sparkles;
  return <Cmp className={className} />;
}
