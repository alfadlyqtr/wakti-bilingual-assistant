
import { useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useRecordingStore } from "./useRecordingStore";
import { supabase } from "@/integrations/supabase/client";
import { callEdgeFunctionWithRetry } from "@/integrations/supabase/client";
import { getFileExtension } from "@/utils/audioUtils";

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

  // Poll for transcription status
  const pollTranscriptionStatus = useCallback(async (summaryId: string) => {
    if (!user || !summaryId) return;
    
    try {
      console.log(`Polling transcription status for summaryId: ${summaryId}`);
      // Check if the transcription is complete
      const { data, error } = await supabase
        .from('voice_summaries')
        .select('transcript, is_processing_transcript, transcript_error')
        .eq('id', summaryId)
        .single();
      
      if (error) {
        console.error("Error fetching transcription status:", error);
        return false;
      }
      
      // If there's an error with transcription
      if (data.transcript_error) {
        console.error("Transcription error:", data.transcript_error);
        setError(`Transcription failed: ${data.transcript_error}`);
        setStatus('error');
        return false;
      }
      
      // If transcription is complete and we have the transcript
      if (!data.is_processing_transcript && data.transcript) {
        console.log("Transcription complete, setting transcript");
        setTranscription(data.transcript);
        return true;
      }
      
      console.log("Transcript still processing...");
      return false;
    } catch (error) {
      console.error("Error polling transcription status:", error);
      return false;
    }
  }, [user, setTranscription, setStatus, setError]);

  const transcribeRecording = useCallback(async (audioUrl: string, mimeType?: string) => {
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
      
      // Get file format from mime type
      const fileFormat = mimeType ? getFileExtension(mimeType) : 'webm';
      console.log(`Using file format: ${fileFormat} for transcription`);
      
      // Insert a record in the voice_summaries table
      const { data: summaryRecord, error: insertError } = await supabase
        .from('voice_summaries')
        .insert([{
          user_id: user.id,
          title: title || "Untitled",
          type: type,
          audio_url: audioUrl,
          file_format: fileFormat, // Add the file format to the record
          expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
          is_processing_transcript: true
        }])
        .select()
        .single();
      
      if (insertError) {
        console.error("Error inserting summary record:", insertError);
        throw insertError;
      }
      
      console.log("Created summary record:", summaryRecord);
      
      // Call the transcribe edge function
      const result = await callEdgeFunctionWithRetry<{
        transcript: string;
        error?: string;
        text?: string;
      }>('transcribe-audio', {
        body: { 
          recordingId: summaryRecord.id,
          audioUrl,
          filePath: `${user.id}/${recordingId}/recording.${fileFormat}`
        },
        maxRetries: 2,
      });
      
      if (result.error) {
        console.error("Transcription error from edge function:", result.error);
        throw new Error(result.error);
      }
      
      // Check for transcript in result.transcript or result.text (handling both formats)
      const transcript = result.transcript || result.text;
      
      // Check if we have a transcript immediately, otherwise we'll poll for it
      if (transcript) {
        console.log("Got immediate transcript:", transcript);
        setTranscription(transcript);
        
        // If the title is still the default, try to generate a better one
        if (title === "Untitled" && transcript) {
          // Extract first 5-8 words from transcript as title
          const words = transcript.split(/\s+/);
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
      } else {
        console.log("No immediate transcript, will poll for it");
      }
      
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
    updateTranscription,
    pollTranscriptionStatus
  };
};
