
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { MobileNav } from "@/components/MobileNav";
import { useTheme } from "@/providers/ThemeProvider";

export default function AIAssistantPage() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <MobileNav />
    </div>
  );
}
