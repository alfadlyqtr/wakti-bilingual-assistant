
import React, { useState, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { transcribeAudio } from "@/services/chatService";
import { supabase } from "@/integrations/supabase/client";

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  language: string;
  theme: string;
  disabled?: boolean;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscription,
  language,
  theme,
  disabled,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_TIME = 120; // 2 minutes maximum (120 seconds)
  const { showError, showInfo, showSuccess } = useToastHelper();

  const startRecording = async () => {
    try {
      // Get current user - needed for saving the recording
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        showError(language === 'ar' ? 'يجب تسجيل الدخول لاستخدام الإدخال الصوتي' : 'Login required for voice input');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsTranscribing(true);
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        // Store the recording in Supabase Storage
        try {
          // Create a unique file name based on timestamp
          const fileName = `${user.id}/${Date.now()}.webm`;
          
          // Upload to Supabase
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice_recordings')
            .upload(fileName, audioBlob);
            
          if (uploadError) {
            console.error('Error uploading recording:', uploadError);
            setIsTranscribing(false);
            showError(language === 'ar' ? 'فشل في تحميل التسجيل' : 'Failed to upload recording');
            return;
          }
          
          console.log('Recording saved to Supabase:', fileName);
          
          try {
            // Pass recordingId instead of audio blob
            const text = await transcribeAudio(fileName);
            setIsTranscribing(false);
            
            if (text) {
              console.log('Transcription successful:', text);
              showSuccess(language === 'ar' ? 'تم التعرف على الصوت' : 'Voice transcribed successfully');
              onTranscription(text);
            } else {
              showError(language === 'ar' ? 'خطأ في النسخ' : 'Transcription Error');
            }
          } catch (error) {
            setIsTranscribing(false);
            console.error('Error during transcription:', error);
            showError(language === 'ar' 
              ? 'حدث خطأ أثناء معالجة التسجيل الصوتي'
              : 'An error occurred while processing the voice recording');
          }
        } catch (storageErr) {
          setIsTranscribing(false);
          console.error('Error storing recording:', storageErr);
          showError(language === 'ar' ? 'فشل في تخزين التسجيل' : 'Failed to store recording');
        }

        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setRecordingTime(0);
        if (timerInterval) {
          clearInterval(timerInterval);
          setTimerInterval(null);
        }
      };

      // Show info toast about recording starting
      showInfo(language === 'ar' 
        ? 'بدأ التسجيل... تحدث الآن'
        : 'Recording started... speak now');

      // Start recording
      recorder.start(1000); // Collect data in 1-second chunks
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Set up timer
      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            if (recorder.state === 'recording') {
              recorder.stop();
              showInfo(language === 'ar'
                ? 'انتهى وقت التسجيل'
                : 'Recording time limit reached');
            }
            clearInterval(interval);
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

      setTimerInterval(interval);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      showError(language === 'ar' 
        ? 'يرجى السماح بالوصول إلى الميكروفون للاستفادة من ميزة الإدخال الصوتي'
        : 'Please allow microphone access to use voice input feature');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      showInfo(language === 'ar' ? 'جارِ معالجة التسجيل' : 'Processing recording');
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="relative flex items-center">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isTranscribing}
        size="icon"
        variant={isRecording ? "destructive" : "ghost"}
        type="button"
        className={`h-9 w-9 rounded-full transition-all ${
          isRecording ? 'animate-pulse' : ''
        }`}
        title={language === 'ar' ? 'إدخال صوتي' : 'Voice input'}
      >
        {isTranscribing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5 text-primary" />
        )}
      </Button>

      {isRecording && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 text-xs font-mono bg-background border rounded px-2 py-1 shadow-md z-10">
          {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
        </div>
      )}
    </div>
  );
};
