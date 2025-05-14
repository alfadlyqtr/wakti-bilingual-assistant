
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import VoiceSummaryPage from "@/components/voice-summary/VoiceSummaryPage";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";

export default function VoiceSummary() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader title={t("voiceSummary", language)} />
      <div className="flex-1 overflow-y-auto">
        <VoiceSummaryPage />
      </div>
      <MobileNav />
    </div>
  );
}
