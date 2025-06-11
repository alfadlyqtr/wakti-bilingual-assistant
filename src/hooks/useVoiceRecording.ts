
import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToastHelper } from './use-toast-helper';
import { useExtendedQuotaManagement } from './useExtendedQuotaManagement';

export interface VoiceRecordingState {
  isRecording: boolean;
  isProcessing: boolean;
  audioUrl: string | null;
  transcript: string | null;
  error: string | null;
}

export function useVoiceRecording() {
  const [state, setState] = useState<VoiceRecordingState>({
    isRecording: false,
    isProcessing: false,
    audioUrl: null,
    transcript: null,
    error: null
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { showError } = useToastHelper();
  
  // Get voice quota information
  const { totalAvailableCharacters, canUseVoice, loadUserVoiceQuota } = useExtendedQuotaManagement();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setState(prev => ({ ...prev, audioUrl, isRecording: false, isProcessing: true }));
        
        // Convert to base64 for transcription
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await transcribeAudio(base64Audio);
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setState(prev => ({ ...prev, isRecording: true, error: null }));
    } catch (error) {
      console.error('Error starting recording:', error);
      setState(prev => ({ ...prev, error: 'Failed to start recording' }));
      showError('Failed to access microphone');
    }
  }, [showError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [state.isRecording]);

  const transcribeAudio = useCallback(async (audioData: string) => {
    try {
      setState(prev => ({ ...prev, isProcessing: true }));

      const { data, error } = await supabase.functions.invoke('wakti-voice-transcription', {
        body: { audioData }
      });

      if (error) {
        throw error;
      }

      setState(prev => ({ 
        ...prev, 
        transcript: data.text,
        isProcessing: false,
        error: null
      }));

      // Reload voice quota after transcription
      await loadUserVoiceQuota();

      return data.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to transcribe audio',
        isProcessing: false
      }));
      return null;
    }
  }, [loadUserVoiceQuota]);

  const clearRecording = useCallback(() => {
    if (state.audioUrl) {
      URL.revokeObjectURL(state.audioUrl);
    }
    setState({
      isRecording: false,
      isProcessing: false,
      audioUrl: null,
      transcript: null,
      error: null
    });
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    clearRecording,
    totalAvailableCharacters,
    canUseVoice
  };
}
