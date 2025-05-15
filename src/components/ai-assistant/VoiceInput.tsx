
import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { transcribeAudio } from '@/services/chatService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { t } from '@/utils/translations';
import { TranslationKey } from '@/utils/translationTypes';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  language: string;
  theme: string;
  isListening?: boolean;
  disabled?: boolean;
}

export function VoiceInput({ onTranscription, language, theme, disabled = false }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number | null>(null);
  const { user } = useAuth();
  
  // Timer to enforce max recording duration (1 minute)
  const MAX_RECORDING_TIME = 60000; // 60 seconds in milliseconds
  const recordingTimerRef = useRef<number | null>(null);
  
  // Request microphone permission
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // Get all tracks and stop them to turn off the microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Only process if we have audio data
        if (audioChunksRef.current.length > 0) {
          processAudio();
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      startTimeRef.current = Date.now();
      
      // Set a timer to automatically stop recording after MAX_RECORDING_TIME
      recordingTimerRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
          toast({
            title: t("maxRecordingReached" as TranslationKey, language),
            description: t("recordingStoppedAutomatically" as TranslationKey, language),
            variant: "default",
          });
        }
      }, MAX_RECORDING_TIME);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: t("microphoneError" as TranslationKey, language),
        description: t("microphoneAccessDenied" as TranslationKey, language),
        variant: "destructive", 
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear the automatic stop timer
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const processAudio = async () => {
    setIsProcessing(true);
    
    try {
      // Create audio blob from recorded chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Check recording duration
      const recordingDuration = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      console.log(`Recording duration: ${recordingDuration / 1000} seconds`);
      
      // Only process if the recording is at least 0.5 seconds (avoid accidental clicks)
      if (recordingDuration < 500) {
        toast({
          title: t("recordingTooShort" as TranslationKey, language),
          description: t("pleaseRecordLonger" as TranslationKey, language),
          variant: "default",
        });
        setIsProcessing(false);
        return;
      }
      
      // Transcribe audio using our service
      const transcription = await transcribeAudio(audioBlob);
      
      if (transcription) {
        onTranscription(transcription);
      } else {
        toast({
          title: t("transcriptionFailed" as TranslationKey, language),
          description: t("tryAgainOrTypeMessage" as TranslationKey, language),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      toast({
        title: t("processingError" as TranslationKey, language),
        description: t("errorProcessingAudio" as TranslationKey, language),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const isDark = theme === 'dark';
  
  return (
    <Button
      onClick={handleToggleRecording}
      disabled={disabled || isProcessing}
      size="icon"
      variant="ghost"
      className={`h-9 w-9 rounded-full ${isRecording ? 'bg-red-500 text-white hover:bg-red-600' : ''}`}
      type="button"
      aria-label={isRecording ? t("stopRecording" as TranslationKey, language) : t("startRecording" as TranslationKey, language)}
    >
      {isProcessing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-5 w-5" />
      ) : (
        <Mic className="h-5 w-5" />
      )}
    </Button>
  );
}
