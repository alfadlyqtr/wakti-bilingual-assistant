
import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRecordingStore } from "./useRecordingStore";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunctionWithRetry } from "@/integrations/supabase/client";

export const useTranscription = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { 
    recordingId,
    status, 
    title,
    type,
    setStatus, 
    setTranscription,
    setTitle,
    setError 
  } = useRecordingStore();

  const transcribeRecording = useCallback(async (audioUrl: string) => {
    if (!user || !user.id) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to transcribe recordings",
      });
      return false;
    }

    if (!audioUrl) {
      toast({
        variant: "destructive", 
        title: "No Audio URL",
        description: "Audio URL is required for transcription",
      });
      return false;
    }

    try {
      setStatus('transcribing');
      toast({
        title: "Transcribing Audio",
        description: "This may take a few moments...",
      });
      
      // Insert a record in the voice_summaries table
      const { data: summaryRecord, error: insertError } = await supabase
        .from('voice_summaries')
        .insert([{
          user_id: user.id,
          title: title || "Untitled",
          type: type,
          audio_url: audioUrl,
          expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
          is_processing_transcript: true
        }])
        .select()
        .single();
      
      if (insertError) {
        throw insertError;
      }
      
      // Call the transcribe edge function
      const result = await callEdgeFunctionWithRetry<{
        transcript: string;
        error?: string;
      }>('transcribe-audio', {
        body: { 
          recordingId,
          audioUrl,
          summaryId: summaryRecord.id
        },
        maxRetries: 2,
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Update with transcription result
      setTranscription(result.transcript);
      
      // If the title is still the default, try to generate a better one
      if (title === "Untitled" && result.transcript) {
        // Extract first 5-8 words from transcript as title
        const words = result.transcript.split(/\s+/);
        const titleWords = words.slice(0, Math.min(8, words.length));
        const extractedTitle = titleWords.join(' ');
        
        setTitle(extractedTitle);
        
        // Update the title in the database
        await supabase
          .from('voice_summaries')
          .update({ title: extractedTitle })
          .eq('id', summaryRecord.id);
      }
      
      toast({
        title: "Transcription Complete",
        description: "Your recording has been transcribed successfully",
      });
      
      return summaryRecord.id;
    } catch (error) {
      console.error("Transcription error:", error);
      toast({
        variant: "destructive",
        title: "Transcription Error",
        description: "Failed to transcribe the recording",
      });
      setError("Failed to transcribe the recording");
      setStatus('error');
      return false;
    }
  }, [user, recordingId, title, type, setStatus, setTranscription, setTitle, setError, toast]);

  const updateTranscription = useCallback(async (summaryId: string, newTranscript: string) => {
    if (!user || !summaryId) {
      return false;
    }

    try {
      // Update the transcript in the database
      const { error } = await supabase
        .from('voice_summaries')
        .update({ 
          transcript: newTranscript,
          is_processing_transcript: false
        })
        .eq('id', summaryId);
      
      if (error) {
        throw error;
      }
      
      setTranscription(newTranscript);
      return true;
    } catch (error) {
      console.error("Error updating transcription:", error);
      toast({
        variant: "destructive",
        title: "Update Error",
        description: "Failed to update the transcription",
      });
      return false;
    }
  }, [user, setTranscription, toast]);

  return {
    transcribeRecording,
    updateTranscription
  };
};
