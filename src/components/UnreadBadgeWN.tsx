
import React from "react";
import { useWN } from "@/hooks/useWN";

interface UnreadBadgeWNProps {
  type: string;
  size?: "sm" | "md";
  blink?: boolean;
  className?: string;
}

export function UnreadBadgeWN({ type, size = "md", blink = false, className = "" }: UnreadBadgeWNProps) {
  const { getBadgeDisplay } = useWN();
  const badge = getBadgeDisplay(type);
  
  if (!badge.show) return null;

  const sz = size === "sm" ? "h-3 w-3 text-[9px] min-w-[13px]" : "h-5 w-5 text-xs min-w-[20px]";
  const blinkClass = blink ? "animate-blink" : "";
  const priorityClass = badge.priority === 'high' ? 'bg-orange-500' : badge.priority === 'urgent' ? 'bg-red-600 animate-pulse' : 'bg-red-500';

  return (
    <span
      className={`absolute rounded-full
        ${priorityClass} text-white flex items-center justify-center font-bold
        ${sz} ${blinkClass} ${className}
        right-0 -top-1 border-white border-2 z-10`}
      style={{ minWidth: size === "sm" ? 13 : 20 }}
      aria-label={`${badge.count} unread`}
    >
      {badge.count}
    </span>
  );
}

// Animation CSS
if (typeof document !== "undefined") {
  const styleId = "unread-badge-wn-anim";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      @keyframes blinkBadgeAnim {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
      .animate-blink { animation: blinkBadgeAnim 1s linear infinite; }
    `;
    document.head.appendChild(style);
  }
}
