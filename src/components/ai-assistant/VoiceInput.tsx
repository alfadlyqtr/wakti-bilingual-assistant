import React, { useState, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { transcribeAudio } from "@/services/chatService";
import { supabase } from "@/integrations/supabase/client";
import {
  getBestSupportedMimeType,
  getFileExtension,
  formatRecordingTime,
  generateRecordingPath,
  validateRecordingPath
} from "@/utils/audioUtils";
import { createVoiceRecordingsBucket } from "@/utils/debugUtils";

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
  const [isProcessingRequest, setIsProcessingRequest] = useState(false);
  const MAX_RECORDING_TIME = 120; // 2 minutes maximum (120 seconds)

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      
      // Stop recording if component is unmounted while recording
      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [timerInterval, mediaRecorder]);

  const startRecording = async () => {
    // Prevent multiple clicks
    if (isProcessingRequest) {
      return;
    }
    
    setIsProcessingRequest(true);
    
    try {
      // First, ensure the voice_recordings bucket exists with proper configuration
      const { success: bucketSuccess, error: bucketError } = await createVoiceRecordingsBucket();
      
      if (!bucketSuccess) {
        console.error("Error creating/checking voice_recordings bucket:", bucketError);
        toast({
          title: language === 'ar' ? 'خطأ في تهيئة التخزين' : 'Storage initialization error',
          variant: "destructive"
        });
        setIsProcessingRequest(false);
        return;
      }
      
      // Get current user - needed for saving the recording
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: language === 'ar' ? 'يجب تسجيل الدخول لاستخدام الإدخال الصوتي' : 'Login required for voice input',
          variant: "destructive"
        });
        setIsProcessingRequest(false);
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Use the supported MIME type from our utility function
      const mimeType = getBestSupportedMimeType();
      console.log(`Using MIME type for recording: ${mimeType}`);
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsTranscribing(true);
        
        // Get the file extension from the MIME type using our utility function
        const fileExt = getFileExtension(mimeType);
        
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        console.log(`Recording complete: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
        
        // Store the recording in Supabase Storage
        try {
          // Generate a UUID for the recording
          const recordingId = crypto.randomUUID(); 
        
          // CRITICAL: Generate the correct file path using our utility function
          // This must follow the pattern: ${userId}/${recordingId}/recording.webm
          const filePath = generateRecordingPath(user.id, recordingId);
          
          console.log(`Uploading to storage with filePath: ${filePath}`);
          console.log(`User ID: ${user.id}, Recording ID: ${recordingId}`);
          
          // Validate the path before uploading
          const pathValidation = validateRecordingPath(filePath);
          if (!pathValidation.valid) {
            console.error(`Invalid file path generated: ${filePath}`, pathValidation.reason);
            setIsTranscribing(false);
            setIsProcessingRequest(false);
            toast({
              title: language === 'ar' ? 'خطأ في مسار الملف' : 'File path error',
              description: pathValidation.reason,
              variant: "destructive"
            });
            return;
          }
          
          // Upload to Supabase
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('voice_recordings')
            .upload(filePath, audioBlob, {
              contentType: mimeType,
              upsert: false
            });
            
          if (uploadError) {
            console.error('Error uploading recording:', uploadError);
            setIsTranscribing(false);
            setIsProcessingRequest(false);
            toast({
              title: language === 'ar' ? 'فشل في تحميل التسجيل' : 'Failed to upload recording',
              description: uploadError.message,
              variant: "destructive"
            });
            return;
          }
          
          console.log('Recording saved to Supabase:', filePath);
          
          try {
            // Pass recordingId (UUID) for transcription
            console.log('Sending for transcription with UUID:', recordingId);
            // Update the transcribeAudio function to use the UUID parameter and file path
            const text = await transcribeAudio(recordingId, filePath);
            setIsTranscribing(false);
            setIsProcessingRequest(false);
            
            if (text) {
              console.log('Transcription successful:', text);
              toast({
                title: language === 'ar' ? 'تم التعرف على الصوت' : 'Voice transcribed successfully',
                variant: "success"
              });
              onTranscription(text);
            } else {
              toast({
                title: language === 'ar' ? 'خطأ في النسخ' : 'Transcription Error',
                variant: "destructive"
              });
            }
          } catch (error) {
            setIsTranscribing(false);
            setIsProcessingRequest(false);
            console.error('Error during transcription:', error);
            toast({
              title: language === 'ar' 
                ? 'حدث خطأ أثناء معالجة التسجيل الصوتي'
                : 'An error occurred while processing the voice recording',
              variant: "destructive"
            });
          }
        } catch (storageErr) {
          setIsTranscribing(false);
          setIsProcessingRequest(false);
          console.error('Error storing recording:', storageErr);
          toast({
            title: language === 'ar' ? 'فشل في تخزين التسجيل' : 'Failed to store recording',
            variant: "destructive"
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

      // Show info toast about recording starting
      toast({
        title: language === 'ar' ? 'بدأ التسجيل... تحدث الآن' : 'Recording started... speak now',
        variant: "default"
      });

      // Start recording
      recorder.start(1000); // Collect data in 1-second chunks
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsProcessingRequest(false);

      // Set up timer
      const interval = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= MAX_RECORDING_TIME - 1) {
            if (recorder.state === 'recording') {
              recorder.stop();
              toast({
                title: language === 'ar' ? 'انتهى وقت التسجيل' : 'Recording time limit reached',
                variant: "default"
              });
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
      setIsProcessingRequest(false);
      toast({
        title: language === 'ar' 
          ? 'يرجى السماح بالوصول إلى الميكروفون للاستفادة من ميزة الإدخال الصوتي'
          : 'Please allow microphone access to use voice input feature',
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      toast({
        title: language === 'ar' ? 'جارِ معالجة التسجيل' : 'Processing recording',
        variant: "default"
      });
    }
  };

  return (
    <div className="relative flex items-center">
      <Button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isTranscribing || isProcessingRequest}
        size="icon"
        variant={isRecording ? "destructive" : "ghost"}
        type="button"
        className={`h-9 w-9 rounded-full transition-all ${
          isRecording ? 'animate-pulse' : ''
        }`}
        title={language === 'ar' ? 'إدخال صوتي' : 'Voice input'}
      >
        {isTranscribing || isProcessingRequest ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5 text-primary" />
        )}
      </Button>

      {isRecording && (
        <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 text-xs font-mono bg-background border rounded px-2 py-1 shadow-md z-10">
          {formatRecordingTime(recordingTime)} / {formatRecordingTime(MAX_RECORDING_TIME)}
        </div>
      )}
    </div>
  );
};
