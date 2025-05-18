
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryDetail from "@/components/voice-summary/VoiceSummaryDetail";

export default function VoiceSummaryDetailPage() {
  const { language } = useTheme();
  
  return (
    <div className="flex-1 overflow-y-auto">
      <VoiceSummaryDetail />
    </div>
  );
}
