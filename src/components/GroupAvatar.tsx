import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";

// Deterministic color palette based on group name
const COLORS = [
  { bg: "#3B82F6", text: "#FFFFFF" }, // blue
  { bg: "#10B981", text: "#FFFFFF" }, // emerald
  { bg: "#F59E0B", text: "#FFFFFF" }, // amber
  { bg: "#EF4444", text: "#FFFFFF" }, // red
  { bg: "#8B5CF6", text: "#FFFFFF" }, // violet
  { bg: "#EC4899", text: "#FFFFFF" }, // pink
  { bg: "#06B6D4", text: "#FFFFFF" }, // cyan
  { bg: "#F97316", text: "#FFFFFF" }, // orange
  { bg: "#84CC16", text: "#FFFFFF" }, // lime
  { bg: "#6366F1", text: "#FFFFFF" }, // indigo
];

function getColorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLORS.length;
  return COLORS[index];
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

interface GroupAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

export function GroupAvatar({ name, avatarUrl, size = "md", className }: GroupAvatarProps) {
  const color = getColorForName(name);
  const initials = getInitials(name);

  if (avatarUrl) {
    return (
      <Avatar className={cn(SIZE_MAP[size], className)}>
        <AvatarImage src={avatarUrl} alt={name} />
        <AvatarFallback
          className={cn("font-semibold", className)}
          style={{ backgroundColor: color.bg, color: color.text }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold shrink-0",
        SIZE_MAP[size],
        className
      )}
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {initials || <Users className="h-5 w-5" />}
    </div>
  );
}
