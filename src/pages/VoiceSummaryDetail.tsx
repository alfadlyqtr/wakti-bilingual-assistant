
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import VoiceSummaryDetail from "@/components/voice-summary/VoiceSummaryDetail";
import { MobileNav } from "@/components/MobileNav";
import { MobileHeader } from "@/components/MobileHeader";

export default function VoiceSummaryDetailPage() {
  const { language } = useTheme();
  
  return (
    <div className="mobile-container">
      <MobileHeader title={t("voiceSummaryDetail", language)} showBackButton={true} />
      <div className="flex-1 overflow-y-auto">
        <VoiceSummaryDetail />
      </div>
      <MobileNav />
    </div>
  );
}
