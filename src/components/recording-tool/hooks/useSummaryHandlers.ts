
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRecordingStore } from "./useRecordingStore";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunctionWithRetry } from "@/integrations/supabase/client";
import { useTheme } from "@/providers/ThemeProvider";

export const useSummaryHandlers = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useTheme();
  
  const { 
    status,
    transcription,
    setStatus, 
    setSummary,
    setSummaryAudioUrl,
    setError 
  } = useRecordingStore();

  const generateSummary = useCallback(async (summaryId: string) => {
    if (!user || !user.id) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to generate a summary",
      });
      return false;
    }

    if (!transcription) {
      toast({
        variant: "destructive",
        title: "No Transcription",
        description: "Transcription is required to generate a summary",
      });
      return false;
    }

    try {
      setStatus('summarizing');
      toast({
        title: "Generating Summary",
        description: "This may take a moment...",
      });
      
      // Update the voice_summaries record to indicate processing
      await supabase
        .from('voice_summaries')
        .update({
          is_processing_summary: true,
          transcript: transcription, // Ensure transcript is updated
          is_processing_transcript: false
        })
        .eq('id', summaryId);
      
      // Call the summarize edge function
      const result = await callEdgeFunctionWithRetry<{
        summary: string;
        error?: string;
      }>('generate-summary', {
        body: { 
          summaryId,
          transcript: transcription,
          language
        },
        maxRetries: 2,
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Update with summary result
      setSummary(result.summary);
      
      // Update the summary in the database
      await supabase
        .from('voice_summaries')
        .update({
          summary: result.summary,
          is_processing_summary: false,
          summary_language: language
        })
        .eq('id', summaryId);
      
      // Generate TTS for the summary
      await generateTTS(summaryId, result.summary);
      
      toast({
        title: "Summary Complete",
        description: "Your recording has been summarized successfully",
      });
      
      return true;
    } catch (error) {
      console.error("Summary generation error:", error);
      toast({
        variant: "destructive",
        title: "Summary Error",
        description: "Failed to generate summary",
      });
      setError("Failed to generate summary");
      setStatus('error');
      return false;
    }
  }, [user, transcription, language, setStatus, setSummary, setError, toast]);

  const generateTTS = useCallback(async (summaryId: string, summaryText: string) => {
    if (!user || !summaryId || !summaryText) {
      return false;
    }

    try {
      // Update the voice_summaries record to indicate TTS processing
      await supabase
        .from('voice_summaries')
        .update({
          is_processing_tts: true,
        })
        .eq('id', summaryId);
      
      // Default voice based on language
      const defaultVoice = language === 'ar' ? 'alloy' : 'nova';
      
      // Call the TTS edge function
      const result = await callEdgeFunctionWithRetry<{
        audioUrl?: string;
        error?: string;
      }>('generate-tts', {
        body: { 
          summaryId,
          text: summaryText,
          voice: defaultVoice,
          language
        },
        maxRetries: 2,
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (result.audioUrl) {
        setSummaryAudioUrl(result.audioUrl);
        
        // Update the summary audio URL in the database
        await supabase
          .from('voice_summaries')
          .update({
            summary_audio_url: result.audioUrl,
            summary_voice: defaultVoice,
            is_processing_tts: false,
            is_ready: true,
            ready_at: new Date().toISOString()
          })
          .eq('id', summaryId);
      }
      
      setStatus('complete');
      return true;
    } catch (error) {
      console.error("TTS generation error:", error);
      toast({
        variant: "destructive",
        title: "Audio Error",
        description: "Failed to generate summary audio",
      });
      
      // Mark TTS as failed but don't change overall status
      await supabase
        .from('voice_summaries')
        .update({
          is_processing_tts: false,
          tts_error: "Failed to generate TTS audio",
          is_ready: true, // Still mark as ready since the summary exists
          ready_at: new Date().toISOString()
        })
        .eq('id', summaryId);
        
      return false;
    }
  }, [user, language, setStatus, setSummaryAudioUrl, toast]);

  return {
    generateSummary,
    generateTTS
  };
};
