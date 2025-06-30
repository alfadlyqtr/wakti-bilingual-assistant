
import { useEffect, useState } from "react";
import { FawranSubscriptionOverlay } from "@/components/FawranSubscriptionOverlay";

interface SubscriptionOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubscriptionOverlay({ isOpen, onClose }: SubscriptionOverlayProps) {
  return <FawranSubscriptionOverlay isOpen={isOpen} onClose={onClose} />;
}
