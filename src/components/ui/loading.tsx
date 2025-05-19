
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
    lg: "h-8 w-8 border-b-2",
  }[size];

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(`animate-spin rounded-full ${sizeClass} border-primary`)}></div>
    </div>
  );
};

export default LoadingSpinner;
