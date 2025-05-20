
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryPage from "@/components/voice-summary/VoiceSummaryPage";
import { PageContainer } from "@/components/PageContainer";

export default function VoiceSummary() {
  const { language } = useTheme();
  
  return (
    <PageContainer 
      title={language === 'ar' ? "التسجيلات الصوتية" : "Voice Summaries"}
      showBackButton={true}
    >
      <VoiceSummaryPage />
    </PageContainer>
  );
}
