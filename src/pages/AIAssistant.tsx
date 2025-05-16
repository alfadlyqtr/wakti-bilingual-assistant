
import React from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { Toaster } from "@/components/ui/toaster";
import { MobileHeader } from "@/components/MobileHeader";
import { MobileNav } from "@/components/MobileNav";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { AIComparisonHelper } from "@/components/ai-assistant/AIComparisonHelper";

export default function AIAssistantPage() {
  const { language } = useTheme();

  return (
    <div className="mobile-container">
      <AIComparisonHelper />
      <MobileHeader title={t("ai", language)} />
      <div className="flex-1 overflow-hidden">
        <AIAssistant />
      </div>
      <Toaster />
      <MobileNav />
    </div>
  );
}
