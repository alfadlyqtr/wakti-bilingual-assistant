
// Import toast from sonner directly
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getRecordingStatus } from "@/lib/utils";
import { createRecording, uploadAudio, createSummary } from "@/services/voiceSummaryService";

// Define types for the hook
type RecordingState = "idle" | "recording" | "processing" | "stopped";

export default function useVoiceSummaryController() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
        setError(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
        toast.error(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
      }
    };

    initializeRecorder();
  }, [user, language]);

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
      setError(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
      toast.error(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
      let someError = true;
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
      
      // Convert audio chunks to audio blob
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      
      // Create a new recording entry in the database
      const { recording, error: createError } = await createRecording();
      
      if (createError) {
        console.error("Error creating recording:", createError);
        setError(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        toast.error(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        setIsLoading(false);
        return;
      }
      
      setRecordingId(recording.id);
      
      // Upload the audio blob to storage
      const { path, error: uploadError } = await uploadAudio(audioBlob, recording.id);
      
      if (uploadError) {
        console.error("Error uploading audio:", uploadError);
        setError(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        toast.error(language === 'ar' ? 'فشل في تحميل التسجيل الصوتي' : 'Failed to upload audio recording');
        setIsLoading(false);
        return;
      }
      
      // Get recording status using the lib/utils function which returns proper type
      const statusResponse = await getRecordingStatus(recording.id);
      
      if (statusResponse && statusResponse.error) {
        console.error("Error getting recording status:", statusResponse.error);
        setError(language === 'ar' ? 'فشل في الحصول على حالة التسجيل' : 'Failed to get recording status');
        toast.error(language === 'ar' ? 'فشل في الحصول على حالة التسجيل' : 'Failed to get recording status');
        setIsLoading(false);
        return;
      }
      
      let success = true;
      toast.success(language === 'ar' ? 'تم حفظ التسجيل بنجاح' : 'Recording saved successfully');
    } catch (err: any) {
      console.error("Error during recording process:", err);
      setError(language === 'ar' ? 'حدث خطأ أثناء حفظ التسجيل' : 'An error occurred while saving the recording');
      toast.error(language === 'ar' ? 'حدث خطأ أثناء حفظ التسجيل' : 'An error occurred while saving the recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate summary function
  const generateSummary = async () => {
    if (!recordingId) return;

    setIsLoading(true);
    try {
      // Call the createSummary function
      const { data, error: summaryError } = await createSummary(recordingId);
      
      if (summaryError) {
        console.error("Error generating summary:", summaryError);
        setError(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        toast.error(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        setIsLoading(false);
        return;
      }
      
      toast.success(language === 'ar' ? 'تم إنشاء الملخص بنجاح' : 'Summary generated successfully');
      setSummary(data?.summary || null);
    } catch (err: any) {
      console.error("Error generating summary:", err);
      setError(language === 'ar' ? 'حدث خطأ أثناء إنشاء الملخص' : 'An error occurred while generating the summary');
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إنشاء الملخص' : 'An error occurred while generating the summary');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    recordingState,
    startRecording,
    stopRecording,
    generateSummary,
    summary,
    isLoading,
    error,
  };
}
