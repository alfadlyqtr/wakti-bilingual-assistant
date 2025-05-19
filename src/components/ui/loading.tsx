
import React from "react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = "md" }) => {
  const sizeClass = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-8 w-8 border-b-2",
  }[size];

  return (
    <div className="flex items-center justify-center">
      <div className={`animate-spin rounded-full ${sizeClass} border-primary`}></div>
    </div>
  );
};

export default Loading;
