
import React from "react";
import { cn } from "@/lib/utils"; 

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md", className }) => {
  const sizeClass = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-4",
  }[size];

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(`animate-spin rounded-full ${sizeClass} border-primary border-t-transparent`)}></div>
    </div>
  );
};

export default function FullScreenLoading() {
  const [phase, setPhase] = React.useState<"initial" | "still" | "stalled">("initial");

  React.useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("still"), 3000);
    const t2 = window.setTimeout(() => setPhase("stalled"), 10000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className={cn(
      "min-h-screen w-full flex flex-col items-center justify-center",
      "bg-gradient-to-br from-indigo-50 via-white to-purple-50",
      "dark:from-indigo-950/30 dark:via-background dark:to-purple-950/30"
    )}>
      <LoadingSpinner size="lg" />
      <div className="mt-4 text-sm text-muted-foreground">
        {phase === "initial" && <span>Signing you in…</span>}
        {phase === "still" && <span>Still working…</span>}
        {phase === "stalled" && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-3 py-1 rounded-full text-xs bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}
