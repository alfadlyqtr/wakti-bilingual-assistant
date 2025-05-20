
import { useState } from 'react';
import { useRecordingStore } from './useRecordingStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

export const useTranscription = () => {
  const { language } = useTheme();
  const {
    recordingId,
    setTranscription,
    setProcessingStage,
    setProgress,
    setCurrentStep,
    setError,
  } = useRecordingStore();
  
  const [isTranscribing, setIsTranscribing] = useState(false);

  const transcribeAudio = async (userId: string): Promise<boolean> => {
    if (!recordingId) {
      setError(language === 'ar' 
        ? 'معرّف التسجيل غير متوفر' 
        : 'Recording ID not available');
      return false;
    }
    
    try {
      setIsTranscribing(true);
      setProcessingStage('transcribing');
      setProgress(60);
      
      // Get auth session for API call
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No auth session');
      }
      
      // Construct standardized file path for the storage
      const filePath = `${userId}/${recordingId}/recording.mp3`;
      console.log('Generating transcript for recording path:', filePath);
      
      // Call the transcribe-audio edge function
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/transcribe-audio",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: filePath,
            summaryId: recordingId
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Transcription failed');
      }
      
      // Fetch the updated transcript from the database
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('transcript')
        .eq('id', recordingId)
        .single();
      
      if (summaryError) {
        throw summaryError;
      }
      
      if (summaryData && summaryData.transcript) {
        setTranscription(summaryData.transcript);
        setCurrentStep('transcript');
        setProgress(70);
        return true;
      } else {
        throw new Error('No transcript was generated');
      }
      
    } catch (error) {
      console.error('Transcription error:', error);
      setError(language === 'ar'
        ? 'فشل في إنشاء النص: ' + (error as Error).message
        : 'Failed to generate transcript: ' + (error as Error).message);
      return false;
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Update the transcript in the database
  const updateTranscript = async (text: string): Promise<boolean> => {
    if (!recordingId) return false;
    
    try {
      const { error } = await supabase
        .from('voice_summaries')
        .update({ transcript: text })
        .eq('id', recordingId);
      
      if (error) throw error;
      
      setTranscription(text);
      return true;
    } catch (error) {
      console.error('Error updating transcript:', error);
      return false;
    }
  };

  return {
    isTranscribing,
    transcribeAudio,
    updateTranscript
  };
};
