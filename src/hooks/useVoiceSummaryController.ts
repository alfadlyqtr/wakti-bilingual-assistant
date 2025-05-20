// Import toast from sonner directly
import { toast } from "sonner";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getRecordingStatus } from "@/lib/utils";
import * as voiceSummaryService from "@/services/voiceSummaryService";
import { getBestSupportedMimeType, formatRecordingTime, combineAudioBlobs } from "@/utils/audioUtils";

// Define types for the hook
type RecordingState = "idle" | "recording" | "paused" | "processing" | "stopped" | "error";
type ProcessingStep = "uploading" | "transcribing" | "summarizing" | "generating_tts" | "finalizing";

// Define a recording segment
interface RecordingSegment {
  blob: Blob;
  duration: number;
  part: number;
}

export default function useVoiceSummaryController() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [processingStep, setProcessingStep] = useState<ProcessingStep | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingSegments, setRecordingSegments] = useState<RecordingSegment[]>([]);
  const [currentPart, setCurrentPart] = useState<number>(1);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [totalRecordingTime, setTotalRecordingTime] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [isFullyReady, setIsFullyReady] = useState<boolean>(false);
  const [isEditingTranscript, setIsEditingTranscript] = useState<boolean>(false);
  const [editedTranscript, setEditedTranscript] = useState<string | null>(null);
  const [recordingType, setRecordingType] = useState<string>("note");
  const [mimeType, setMimeType] = useState<string>("");
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Refs for timers and audio stream
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Maximum recording time (2 hours = 7200 seconds)
  const MAX_RECORDING_TIME = 7200;

  // Initialize media recorder and determine supported MIME type
  useEffect(() => {
    if (!user) return;

    const initializeRecorder = async () => {
      try {
        const supportedMimeType = getBestSupportedMimeType();
        setMimeType(supportedMimeType);
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        streamRef.current = stream;
        
        const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks((prev) => [...prev, event.data]);
          }
        };

        recorder.onstop = () => {
          // We handle this in the stopRecording function
          console.log("MediaRecorder stopped");
        };

        setMediaRecorder(recorder);
      } catch (err: any) {
        console.error("Error initializing media recorder:", err);
        setErrorMessage(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
        toast(language === 'ar' ? 'فشل في بدء التسجيل الصوتي' : 'Failed to start audio recording');
      }
    };

    initializeRecorder();
    
    return () => {
      // Clean up the stream when the component unmounts
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [user, language]);

  // Reset recording state
  const resetRecording = () => {
    setRecordingState("idle");
    setProcessingStep(null);
    setAudioChunks([]);
    setRecordingSegments([]);
    setCurrentPart(1);
    setRecordingId(null);
    setSummary(null);
    setTranscript(null);
    setEditedTranscript(null);
    setErrorMessage(null);
    setRecordingTime(0);
    setTotalRecordingTime(0);
    setProgress(0);
    setIsFullyReady(false);
    setIsEditingTranscript(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cancel current recording
  const cancelRecording = () => {
    if (mediaRecorder && (recordingState === "recording" || recordingState === "paused")) {
      mediaRecorder.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    resetRecording();
  };

  // Start recording function
  const startRecording = async (type: string = "note") => {
    if (!mediaRecorder || recordingState === "recording") return;

    try {
      // Set recording type
      setRecordingType(type);
      
      // Clear audio chunks if starting fresh
      if (recordingState === "idle" || recordingState === "stopped") {
        setAudioChunks([]);
        setRecordingSegments([]);
        setCurrentPart(1);
        setRecordingTime(0);
        setTotalRecordingTime(0);
      }
      
      setRecordingState("recording");
      mediaRecorder.start(1000); // Collect data in 1-second chunks
      console.log("Recording started or resumed");
      
      // Start or resume the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(time => {
          const newTime = time + 1;
          if (newTime >= MAX_RECORDING_TIME) {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
              toast(language === 'ar' ? 'تم الوصول إلى الحد الأقصى لمدة التسجيل' : 'Maximum recording duration reached');
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
            }
            return MAX_RECORDING_TIME;
          }
          return newTime;
        });
      }, 1000) as unknown as number;
      
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
      toast(language === 'ar' ? 'حدث خطأ أثناء بدء التسجيل' : 'An error occurred while starting the recording');
    }
  };

  // Pause recording function
  const pauseRecording = async () => {
    if (!mediaRecorder || recordingState !== "recording") return;

    try {
      mediaRecorder.stop(); // Stop the current segment
      
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Save the current segment
      const currentSegment: RecordingSegment = {
        blob: new Blob(audioChunks, { type: mimeType }),
        duration: recordingTime,
        part: currentPart
      };
      
      setRecordingSegments(segments => [...segments, currentSegment]);
      setAudioChunks([]); // Clear chunks for next segment
      setCurrentPart(part => part + 1);
      setTotalRecordingTime(time => time + recordingTime);
      setRecordingTime(0);
      setRecordingState("paused");
      
      // Create a new recorder for the next segment
      if (streamRef.current) {
        const newRecorder = new MediaRecorder(streamRef.current, { mimeType });
        
        newRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            setAudioChunks((prev) => [...prev, event.data]);
          }
        };
        
        setMediaRecorder(newRecorder);
      }
      
      toast.info(language === 'ar' ? 'تم إيقاف التسجيل مؤقتًا' : 'Recording paused');
      
    } catch (err: any) {
      console.error("Error pausing recording:", err);
      setErrorMessage(language === 'ar' ? 'حدث خطأ أثناء إيقاف التسجيل مؤقتًا' : 'An error occurred while pausing the recording');
      toast(language === 'ar' ? 'حدث خطأ أثناء إيقاف التسجيل مؤقتًا' : 'An error occurred while pausing the recording');
    }
  };

  // Stop recording function
  const stopRecording = async () => {
    if (!mediaRecorder || (recordingState !== "recording" && recordingState !== "paused")) return;

    setIsLoading(true);
    try {
      // Stop recording if active
      if (recordingState === "recording" && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
      
      // Stop the timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      // Set state to processing
      setRecordingState("processing");
      setProcessingStep("uploading");
      
      // If currently recording, save the current segment
      if (recordingState === "recording" && audioChunks.length > 0) {
        const finalSegment: RecordingSegment = {
          blob: new Blob(audioChunks, { type: mimeType }),
          duration: recordingTime,
          part: currentPart
        };
        
        setRecordingSegments(segments => [...segments, finalSegment]);
        setTotalRecordingTime(time => time + recordingTime);
      }
      
      // Combine all segments into a single audio blob
      let finalAudioBlob: Blob;
      if (recordingSegments.length === 0) {
        // Single segment recording (no pauses)
        finalAudioBlob = new Blob(audioChunks, { type: mimeType });
      } else if (recordingState === "paused" && audioChunks.length === 0) {
        // Multiple segments but already paused (no current segment)
        const segmentBlobs = recordingSegments.map(segment => segment.blob);
        finalAudioBlob = await combineAudioBlobs(segmentBlobs, mimeType);
      } else {
        // Multiple segments plus current segment
        const blobs = [...recordingSegments.map(segment => segment.blob)];
        const currentBlob = new Blob(audioChunks, { type: mimeType });
        blobs.push(currentBlob);
        finalAudioBlob = await combineAudioBlobs(blobs, mimeType);
      }
      
      // Create a new recording entry in the database
      const { recording, error: createError, userId } = await voiceSummaryService.createRecording(recordingType);
      
      if (createError) {
        console.error("Error creating recording:", createError);
        setErrorMessage(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        toast(language === 'ar' ? 'فشل في حفظ التسجيل' : 'Failed to save recording');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      setRecordingId(recording.id);
      
      // Upload the audio blob to storage with the userId for path construction
      const { path, error: uploadError, publicUrl } = await voiceSummaryService.uploadAudio(finalAudioBlob, recording.id, userId);
      
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
      
      // Start the transcription process
      setProcessingStep("transcribing");
      const { transcription, error: transcriptionError, text } = await voiceSummaryService.transcribeAudio(recording.id);
      
      if (transcriptionError) {
        console.error("Error transcribing audio:", transcriptionError);
        setErrorMessage(language === 'ar' ? 'فشل في تحويل الصوت إلى نص' : 'Failed to transcribe audio');
        toast(language === 'ar' ? 'فشل في تحويل الصوت إلى نص' : 'Failed to transcribe audio');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      // Format transcription with part labels if we have multiple segments
      setTranscript(text);
      setEditedTranscript(text);
      
      // Start the summary generation process
      setProcessingStep("summarizing");
      const { data: summaryData, error: summaryError } = await voiceSummaryService.createSummary(recording.id);
      
      if (summaryError) {
        console.error("Error generating summary:", summaryError);
        setErrorMessage(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        toast(language === 'ar' ? 'فشل في إنشاء الملخص' : 'Failed to generate summary');
        setRecordingState("error");
        setIsLoading(false);
        return;
      }
      
      setSummary(summaryData?.summary || null);
      
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
      setRecordingState("stopped");
    }
  };

  // Save edited transcript
  const saveTranscript = async () => {
    if (!recordingId || !editedTranscript) return;
    
    setIsLoading(true);
    try {
      const { success, error } = await voiceSummaryService.updateTranscript(recordingId, editedTranscript);
      
      if (!success) {
        console.error("Error updating transcript:", error);
        toast.error(language === 'ar' ? 'فشل في حفظ النص' : 'Failed to save transcript');
        return;
      }
      
      setTranscript(editedTranscript);
      setIsEditingTranscript(false);
      toast.success(language === 'ar' ? 'تم حفظ النص بنجاح' : 'Transcript saved successfully');
      
    } catch (err) {
      console.error("Error saving transcript:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء حفظ النص' : 'An error occurred while saving the transcript');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate TTS for summary
  const generateTTS = async (voiceGender: "male" | "female" = "male", language: "en" | "ar" = "en") => {
    if (!recordingId) return;
    
    setIsLoading(true);
    try {
      const { success, audioUrl, error } = await voiceSummaryService.generateTTS(recordingId, voiceGender, language);
      
      if (!success) {
        console.error("Error generating TTS:", error);
        toast.error(language === 'ar' ? 'فشل في إنشاء الصوت' : 'Failed to generate audio');
        return;
      }
      
      toast.success(language === 'ar' ? 'تم إنشاء الصوت بنجاح' : 'Audio generated successfully');
      
      return audioUrl;
    } catch (err) {
      console.error("Error generating TTS:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء إنشاء الصوت' : 'An error occurred while generating audio');
    } finally {
      setIsLoading(false);
    }
  };

  // Export summary as PDF
  const exportAsPDF = async () => {
    if (!recordingId) return;
    
    setIsLoading(true);
    try {
      const { pdfBlob, error } = await voiceSummaryService.exportSummaryAsPDF(recordingId);
      
      if (error || !pdfBlob) {
        console.error("Error exporting PDF:", error);
        toast.error(language === 'ar' ? 'فشل في تصدير الملخص كملف PDF' : 'Failed to export summary as PDF');
        return;
      }
      
      // Create a download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `wakti-summary-${recordingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(language === 'ar' ? 'تم تصدير الملخص بنجاح' : 'Summary exported successfully');
    } catch (err) {
      console.error("Error exporting PDF:", err);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء تصدير الملخص' : 'An error occurred while exporting the summary');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy summary to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(language === 'ar' ? 'تم نسخ النص إلى الحافظة' : 'Copied to clipboard');
    } catch (err) {
      console.error("Error copying to clipboard:", err);
      toast.error(language === 'ar' ? 'فشل في نسخ النص' : 'Failed to copy text');
    }
  };

  // Check if recording has reached the maximum duration
  const isMaxDurationReached = totalRecordingTime + recordingTime >= MAX_RECORDING_TIME;

  return {
    recordingState,
    processingStep,
    startRecording,
    stopRecording,
    pauseRecording,
    cancelRecording,
    resetRecording,
    summary,
    transcript,
    isLoading,
    error: errorMessage,
    recordingTime,
    totalRecordingTime,
    isMaxDurationReached,
    progress,
    recordingId,
    isFullyReady,
    currentPart,
    recordingSegments,
    isEditingTranscript,
    setIsEditingTranscript,
    editedTranscript,
    setEditedTranscript,
    saveTranscript,
    generateTTS,
    exportAsPDF,
    copyToClipboard,
    // State object for RecordingDialog
    state: {
      recordingState,
      processingStep,
      recordingTime,
      totalRecordingTime,
      isMaxDurationReached,
      progress,
      errorMessage,
      isFullyReady,
      recordingId,
      currentPart
    }
  };
}
