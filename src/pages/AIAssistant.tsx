
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { MobileNav } from "@/components/MobileNav";

export default function AIAssistantPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <MobileNav />
    </div>
  );
}
