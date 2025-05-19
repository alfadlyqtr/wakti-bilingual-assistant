
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VoiceSummaryDetail from "@/components/voice-summary/VoiceSummaryDetail";
import { useTheme } from "@/providers/ThemeProvider";

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
    <div className="flex-1 overflow-y-auto">
      <VoiceSummaryDetail />
    </div>
  );
}
