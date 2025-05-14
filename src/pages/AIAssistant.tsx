
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { Toaster } from "@/components/ui/toaster";

export default function AIAssistantPage() {
  return (
    <div className="mobile-container">
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <Toaster />
      {/* MobileNav is rendered in App.tsx globally */}
    </div>
  );
}
