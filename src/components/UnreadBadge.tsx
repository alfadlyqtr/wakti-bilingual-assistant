
import React from "react";

interface UnreadBadgeProps {
  count: number;
  size?: "sm" | "md";
  blink?: boolean;
  className?: string;
}

export function UnreadBadge({ count, size = "md", blink = false, className = "" }: UnreadBadgeProps) {
  // Debug logging
  console.log(`🔍 UnreadBadge render: count=${count}, size=${size}, blink=${blink}`);
  
  if (!count || count < 1) {
    console.log(`🔍 UnreadBadge not rendering: count is ${count}`);
    return null;
  }

  const display = count > 99 ? "99+" : count;
  const sz = size === "sm" ? "h-3 w-3 text-[9px] min-w-[13px]" : "h-5 w-5 text-xs min-w-[20px]";
  const blinkClass = blink ? "animate-blink" : "";

  console.log(`🔍 UnreadBadge rendering with display=${display}, classes=${sz} ${blinkClass}`);

  return (
    <span
      className={`absolute rounded-full
        bg-red-500 text-white flex items-center justify-center font-bold
        ${sz} ${blinkClass} ${className}
        right-0 -top-1 border-white border-2 z-[1001]`}
      style={{ minWidth: size === "sm" ? 13 : 20 }}
      aria-label={`${count} unread`}
    >
      {display}
    </span>
  );
}

// Animation CSS
if (typeof document !== "undefined") {
  const styleId = "unread-badge-anim";
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
