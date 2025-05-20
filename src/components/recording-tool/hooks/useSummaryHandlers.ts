
import { useState } from 'react';
import { useRecordingStore } from './useRecordingStore';
import { supabase } from '@/integrations/supabase/client';
import { useTheme } from '@/providers/ThemeProvider';

export const useSummaryHandlers = () => {
  const { language } = useTheme();
  const {
    recordingId,
    transcription,
    setSummary,
    setSummaryAudioUrl,
    setProcessingStage,
    setProgress,
    setCurrentStep,
    setError,
  } = useRecordingStore();
  
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  const generateSummary = async (): Promise<boolean> => {
    if (!recordingId || !transcription) {
      setError(language === 'ar' 
        ? 'النص غير متوفر لإنشاء الملخص' 
        : 'Transcript not available for summarization');
      return false;
    }
    
    try {
      setIsGeneratingSummary(true);
      setProcessingStage('summarizing');
      setProgress(80);
      
      // Get auth session for API call
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No auth session');
      }
      
      // Call the summarize endpoint
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-summary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: recordingId
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Summary generation failed');
      }
      
      // Fetch the summary from the database
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('summary')
        .eq('id', recordingId)
        .single();
      
      if (summaryError) {
        throw summaryError;
      }
      
      if (summaryData && summaryData.summary) {
        setSummary(summaryData.summary);
        setProgress(90);
        
        // Generate TTS after summary is created
        await generateTTS(summaryData.summary);
        
        return true;
      } else {
        throw new Error('No summary was generated');
      }
      
    } catch (error) {
      console.error('Summary generation error:', error);
      setError(language === 'ar'
        ? 'فشل في إنشاء الملخص: ' + (error as Error).message
        : 'Failed to generate summary: ' + (error as Error).message);
      return false;
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const generateTTS = async (summaryText: string): Promise<boolean> => {
    if (!recordingId) return false;
    
    try {
      setIsGeneratingAudio(true);
      setProcessingStage('generating_tts');
      
      // Get auth session for API call
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('No auth session');
      }
      
      // Default voice based on language
      const defaultVoice = language === 'ar' ? 'alloy' : 'nova';
      
      // Call the TTS endpoint
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/text-to-speech",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session.access_token}`
          },
          body: JSON.stringify({
            recordingId: recordingId,
            text: summaryText,
            voice: defaultVoice,
            language: language === 'ar' ? 'ar' : 'en'
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'TTS generation failed');
      }
      
      // Fetch the summary audio URL from the database
      const { data: summaryData, error: summaryError } = await supabase
        .from('voice_summaries')
        .select('summary_audio_url, is_ready')
        .eq('id', recordingId)
        .single();
      
      if (summaryError) {
        throw summaryError;
      }
      
      if (summaryData && summaryData.summary_audio_url) {
        setSummaryAudioUrl(summaryData.summary_audio_url);
        setProcessingStage('finalizing');
        setProgress(100);
        setCurrentStep('complete');
        return true;
      } else {
        throw new Error('No summary audio was generated');
      }
      
    } catch (error) {
      console.error('TTS generation error:', error);
      // Don't set error state here, as we still have a usable summary
      return false;
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // Update the summary in the database
  const updateSummary = async (text: string): Promise<boolean> => {
    if (!recordingId) return false;
    
    try {
      const { error } = await supabase
        .from('voice_summaries')
        .update({ summary: text })
        .eq('id', recordingId);
      
      if (error) throw error;
      
      setSummary(text);
      return true;
    } catch (error) {
      console.error('Error updating summary:', error);
      return false;
    }
  };

  return {
    isGeneratingSummary,
    isGeneratingAudio,
    generateSummary,
    generateTTS,
    updateSummary
  };
};
