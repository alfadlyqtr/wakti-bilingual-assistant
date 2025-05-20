
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VoiceSummaryDetail from "@/components/voice-summary/VoiceSummaryDetail";
import { useTheme } from "@/providers/ThemeProvider";
import { PageContainer } from "@/components/PageContainer";

export default function VoiceSummaryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  useEffect(() => {
    // If accessed directly via URL but no ID is provided, redirect back to the main page
    if (!id) {
      navigate('/voice-summary');
    }
  }, [id, navigate]);

  return (
    <PageContainer 
      title={language === 'ar' ? "تفاصيل التسجيل" : "Recording Details"}
      showBackButton={true}
    >
      <VoiceSummaryDetail />
    </PageContainer>
  );
}
