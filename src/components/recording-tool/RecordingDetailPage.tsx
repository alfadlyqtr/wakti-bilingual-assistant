
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import TranscriptionPanel from "./TranscriptionPanel";
import SummaryPanel from "./SummaryPanel";
import SummaryExporter from "./SummaryExporter";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { toast } from "sonner";

const RecordingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useTheme();
  
  const [isLoading, setIsLoading] = useState(true);
  
  const {
    reset,
    setRecordingId,
    setTitle,
    setRecordingType,
    setAudioUrl,
    setTranscription,
    setSummary,
    setSummaryAudioUrl,
    setCurrentStep,
  } = useRecordingStore();
  
  // Fetch recording details
  useEffect(() => {
    const fetchRecordingDetails = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from("voice_summaries")
          .select("*")
          .eq("id", id)
          .single();
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          throw new Error("Recording not found");
        }
        
        // Initialize the recording store with fetched data
        reset();
        setRecordingId(data.id);
        setTitle(data.title || "");
        setRecordingType(data.type || "note");
        setAudioUrl(data.audio_url);
        setTranscription(data.transcript);
        setSummary(data.summary);
        setSummaryAudioUrl(data.summary_audio_url);
        
        // Set the appropriate step based on available data
        if (data.summary) {
          setCurrentStep("complete");
        } else if (data.transcript) {
          setCurrentStep("transcript");
        } else {
          setCurrentStep("processing");
        }
        
      } catch (error) {
        console.error("Error fetching recording details:", error);
        toast.error(
          language === "ar"
            ? "فشل في تحميل تفاصيل التسجيل"
            : "Failed to load recording details"
        );
        navigate("/voice-summary");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecordingDetails();
    
    // Cleanup
    return () => {
      reset();
    };
  }, [id, navigate, language, reset, setRecordingId, setTitle, setRecordingType, 
      setAudioUrl, setTranscription, setSummary, setSummaryAudioUrl, setCurrentStep]);
  
  const handleBackClick = () => {
    navigate("/voice-summary");
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">
          {language === "ar" ? "جارٍ التحميل..." : "Loading..."}
        </p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4 pb-20">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={handleBackClick}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">{useRecordingStore.getState().title}</h1>
      </div>
      
      <div className="space-y-6">
        <TranscriptionPanel />
        <SummaryPanel />
        <SummaryExporter />
      </div>
    </div>
  );
};

export default RecordingDetailPage;
