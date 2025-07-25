
import React from "react";
import { ArrowRight, ArrowLeft, ArrowLeftRight } from "lucide-react";

interface ContactRelationshipIndicatorProps {
  status: "mutual" | "you-added-them" | "they-added-you";
}

export function ContactRelationshipIndicator({
  status,
}: ContactRelationshipIndicatorProps) {
  let icon;
  let color = "text-muted-foreground";
  let label = "";

  switch (status) {
    case "mutual":
      icon = <ArrowLeftRight size={14} className={color} />;
      label = "Both added";
      break;
    case "you-added-them":
      icon = <ArrowRight size={14} className={color} />;
      label = "You added";
      break;
    case "they-added-you":
      icon = <ArrowLeft size={14} className={color} />;
      label = "They added";
      break;
    default:
      icon = null;
  }

  return (
    <span title={label} className="ml-1 flex items-center">
      {icon}
    </span>
  );
}
