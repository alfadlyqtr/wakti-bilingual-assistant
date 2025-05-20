
// Import toast from sonner directly
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getRecordingStatus } from "@/lib/utils";
import * as voiceSummaryService from "@/services/voiceSummaryService";
import { getBestSupportedMimeType, formatRecordingTime, getFileExtension } from "@/utils/audioUtils";

// Define types for the hook
type RecordingState = "idle" | "recording" | "processing" | "stopped" | "error";
type ProcessingStep = "uploading" | "transcribing" | "summarizing" | "generating_tts" | "finalizing";

// Define a type for the recording status
interface RecordingStatus {
  status: "pending" | "processing" | "complete" | "transcribing";
  errorMessage?: string;
}

export default function useVoiceSummaryController() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [processingStep, setProcessingStep] = useState<ProcessingStep | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isFullyReady, setIsFullyReady] = useState<boolean>(false);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const timerRef = useRef<number | null>(null);
  
  // Maximum recording duration in seconds (2 hours = 7200 seconds)
  const MAX_RECORDING_DURATION = 7200;

  // Initialize media recorder
  useEffect(() => {
    if (!user) return;

    const initializeRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Use the best supported MIME type from audioUtils
        const mimeType = getBestSupportedMimeType();
        console.log("Using MIME type for recording:", mimeType);
        
        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks((prev) => [...prev, event.data]);
          }
        };

        recorder.onstop = () => {
          console.log("MediaRecorder stopped");
          setRecordingState("stopped");
        };

        setMediaRecorder(recorder);
      } catch (err: any) {
        console.error("Error initializing media recorder:", err);
        setErrorMessage(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
        toast(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
      }
    };

    initializeRecorder();
  }, [user, language]);

  // Stop timer when component unmounts
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Reset recording state
  const resetRecording = () => {
    // Clear timer if running
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setRecordingState("idle");
    setProcessingStep(null);
    setAudioChunks([]);
    setRecordingId(null);
    setSummary(null);
    setErrorMessage(null);
    setRecordingTime(0);
    setProgress(0);
    setIsFullyReady(false);
  };

  // Cancel current recording
  const cancelRecording = () => {
    if (mediaRecorder && recordingState === "recording") {
      mediaRecorder.stop();
      console.log("Recording cancelled");
      
      // Stop all tracks to release the microphone
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
    
    // Clear recording timer
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    resetRecording();
  };

  // Start recording function
  const startRecording = async (recordingType: string = "note") => {
    if (!mediaRecorder || recordingState === "recording") return;

    try {
      setAudioChunks([]);
      setRecordingState("recording");
      setRecordingTime(0);
      
      // Start recording with 1 second chunks
      mediaRecorder.start(1000);
      console.log("Recording started with type:", recordingType);
      
      // Start the timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prevTime => {
          // Stop recording if we reach maximum duration
          if (prevTime >= MAX_RECORDING_DURATION - 1) {
            if (mediaRecorder && mediaRecorder.state === "recording") {
              mediaRecorder.stop();
              console.log("Reached maximum recording duration, stopping");
            }
            
            if (timerRef.current) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            return MAX_RECORDING_DURATION;
          }
          return prevTime + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
      toast(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
    }
  };

  // Stop recording function
  const stopRecording = async () => {
    if (!mediaRecorder || recordingState !== "recording") return;

    setIsLoading(true);
    try {
      // Clear timer
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log("Stopping recording after", recordingTime, "seconds");
      mediaRecorder.stop();
      
      // Stop all tracks to release the microphone
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      
      setRecordingState("processing");
      setProcessingStep("uploading");
      
      // We need to wait for the ondataavailable event to complete
      // Let's add a small delay to ensure we have all chunks
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Convert audio chunks to audio blob
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      console.log("Audio blob created:", audioBlob.size, "bytes with type", audioBlob.type);
      
      // Create a new recording entry in the database
      const { recording, error: createError, userId } = await voiceSummaryService.createRecording();
      
      if (createError) {
        console.error("Error creating recording:", createError);
        setErrorMessage(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        toast(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      setRecordingId(recording.id);
      setProcessingStep("transcribing");
      
      // Upload the audio blob to storage with the userId for path construction
      const { path, error: uploadError, publicUrl } = await voiceSummaryService.uploadAudio(audioBlob, recording.id, userId);
      
      if (uploadError) {
        console.error("Error uploading audio:", uploadError);
        setErrorMessage(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        toast(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      console.log("Audio uploaded successfully to:", path);
      console.log("Public URL:", publicUrl);
      
      // Get recording status using the lib/utils function
      const statusResponse = await getRecordingStatus(recording.id);
      
      // Cast the response to RecordingStatus type after ensuring it's valid
      const typedStatusResponse = statusResponse as unknown as RecordingStatus;
      
      if (typedStatusResponse && typedStatusResponse.errorMessage) {
        console.error("Error getting recording status:", typedStatusResponse.errorMessage);
        setErrorMessage(language === 'ar' ? 'فشل في الحصول على حالة التسجيل' : 'Failed to get recording status');
        toast(language === 'ar' ? 'فشل في الحصول على حالة التسجيل' : 'Failed to get recording status');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      setProcessingStep("finalizing");
      setIsFullyReady(true);
      toast.success(language === 'ar' ? 'تم حفظ التسجيل بنجاح' : 'Recording saved successfully');
    } catch (err: any) {
      console.error("Error during recording process:", err);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء حفظ التسجيل' : 'An error occurred while saving the recording');
      toast(language === 'ar' ? 'حدث خطأ أثناء حفظ التسجيل' : 'An error occurred while saving the recording');
      setRecordingState("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Wait for recording completion
  const waitForCompletion = async (recordingId: string) => {
    if (!recordingId) return false;
    
    // Implementation for checking recording completion
    return true;
  };

  // Generate summary function
  const generateSummary = async () => {
    if (!recordingId) return;

    setIsLoading(true);
    try {
      // Call the createSummary function
      const { data, error: summaryError } = await voiceSummaryService.createSummary(recordingId);
      
      if (summaryError) {
        console.error("Error generating summary:", summaryError);
        setErrorMessage(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        toast(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        setIsLoading(false);
        return;
      }
      
      toast.success(language === 'ar' ? 'تم إنشاء الملخص بنجاح' : 'Summary generated successfully');
      setSummary(data?.summary || null);
    } catch (err: any) {
      console.error("Error generating summary:", err);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء إنشاء الملخص' : 'An error occurred while generating the summary');
      toast(language === 'ar' ? 'حدث خطأ أثناء إنشاء الملخص' : 'An error occurred while generating the summary');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    recordingState,
    processingStep,
    startRecording,
    stopRecording,
    cancelRecording,
    resetRecording,
    waitForCompletion,
    generateSummary,
    summary,
    isLoading,
    error: errorMessage,
    recordingTime,
    progress,
    recordingId,
    isFullyReady,
    // Additional state properties for RecordingDialog
    state: {
      recordingState,
      processingStep,
      recordingTime,
      progress,
      errorMessage,
      isFullyReady,
      recordingId
    }
  };
}
