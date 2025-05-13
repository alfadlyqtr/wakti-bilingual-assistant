
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { MobileNav } from "@/components/MobileNav";

export default function AIAssistantPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AIAssistant />
      <MobileNav />
    </div>
  );
}
