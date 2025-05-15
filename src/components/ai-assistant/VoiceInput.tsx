
import React, { useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { transcribeAudio } from "@/services/chatService";

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
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const MAX_RECORDING_TIME = 60; // 60 seconds maximum

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        
        try {
          const text = await transcribeAudio(audioBlob);
          if (text) {
            onTranscription(text);
          } else {
            toast({
              title: language === 'ar' ? 'خطأ في النسخ' : 'Transcription Error',
              description: language === 'ar' 
                ? 'لم نتمكن من تحويل الصوت إلى نص. يرجى المحاولة مرة أخرى.'
                : 'We couldn\'t convert the audio to text. Please try again.',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('Error during transcription:', error);
          toast({
            title: language === 'ar' ? 'خطأ' : 'Error',
            description: language === 'ar'
              ? 'حدث خطأ أثناء معالجة التسجيل الصوتي'
              : 'An error occurred while processing the voice recording',
            variant: 'destructive',
          });
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

      // Start recording
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);

      // Set up timer
      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            if (recorder.state === 'recording') {
              recorder.stop();
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
      toast({
        title: language === 'ar' ? 'خطأ في الوصول للميكروفون' : 'Microphone Access Error',
        description: language === 'ar'
          ? 'يرجى السماح بالوصول إلى الميكروفون للاستفادة من ميزة الإدخال الصوتي'
          : 'Please allow microphone access to use voice input feature',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
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
        disabled={disabled}
        size="icon"
        variant={isRecording ? "destructive" : "ghost"}
        type="button"
        className={`h-9 w-9 rounded-full transition-all ${
          isRecording ? 'animate-pulse' : ''
        }`}
        title={language === 'ar' ? 'إدخال صوتي' : 'Voice input'}
      >
        {isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {isRecording && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 text-xs font-mono bg-background border rounded px-2 py-1 shadow-md">
          {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_TIME)}
        </div>
      )}
    </div>
  );
};
