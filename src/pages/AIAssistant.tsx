
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export default function AIAssistantPage() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader title={t("assistant", language)} />
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <MobileNav />
    </div>
  );
}
