
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import VoiceSummaryPage from "@/components/voice-summary/VoiceSummaryPage";

export default function VoiceSummary() {
  const { language } = useTheme();
  
  return (
    <div className="flex-1 overflow-y-auto">
      <VoiceSummaryPage />
    </div>
  );
}
