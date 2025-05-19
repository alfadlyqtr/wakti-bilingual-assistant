
// Import toast from sonner directly
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getRecordingStatus } from "@/lib/utils";
import * as voiceSummaryService from "@/services/voiceSummaryService";

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

  // Initialize media recorder
  useEffect(() => {
    if (!user) return;

    const initializeRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks((prev) => [...prev, event.data]);
          }
        };

        recorder.onstop = () => {
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

  // Reset recording state
  const resetRecording = () => {
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
    }
    resetRecording();
  };

  // Start recording function
  const startRecording = async () => {
    if (!mediaRecorder || recordingState === "recording") return;

    try {
      setAudioChunks([]);
      setRecordingState("recording");
      mediaRecorder.start();
      console.log("Recording started");
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
      mediaRecorder.stop();
      console.log("Recording stopped");
      setRecordingState("processing");
      setProcessingStep("uploading");
      
      // Convert audio chunks to audio blob
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      
      // Create a new recording entry in the database
      const { recording, error: createError } = await voiceSummaryService.createRecording();
      
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
      
      // Upload the audio blob to storage
      const { path, error: uploadError } = await voiceSummaryService.uploadAudio(audioBlob, recording.id);
      
      if (uploadError) {
        console.error("Error uploading audio:", uploadError);
        setErrorMessage(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        toast(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
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
