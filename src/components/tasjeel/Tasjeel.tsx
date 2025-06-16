import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, callEdgeFunctionWithRetry, saveTasjeelRecord, updateTasjeelRecord, uploadAudioFile } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast-helper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generatePDF } from "@/utils/pdfUtils";
import { Logo3D } from "@/components/Logo3D";
import { t } from "@/utils/translations";
import {
  Mic, 
  StopCircle, 
  Share, 
  Copy, 
  Download, 
  Edit, 
  PlayCircle, 
  PauseCircle, 
  FileText, 
  RefreshCw,
  ClipboardCopy,
  Volume2,
  Save,
  History,
  Upload,
  Zap,
  Timer,
  AlertCircle
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import SavedRecordings from "./SavedRecordings";
import { SummaryAudioUploadResult } from "./types";

// Define maximum recording time (30 minutes in seconds)
const MAX_RECORDING_TIME = 1800; // 30 minutes
const WARNING_TIME_1 = 300; // 5 minutes left (25 minute mark)
const WARNING_TIME_2 = 60; // 1 minute left (29 minute mark)

// Translations
const translations = {
  en: {
    pageTitle: "Tasjeel",
    recordLabel: "Record your voice",
    startRecording: "Start Recording",
    stopRecording: "Stop Recording",
    processingRecording: "Processing recording...",
    transcribingAudio: "Transcribing audio...",
    transcriptionLabel: "Transcription",
    copy: "Copy",
    copiedToClipboard: "Copied to clipboard",
    summarize: "Summarize",
    summarizingText: "Summarizing...",
    summaryLabel: "Summary",
    generateAudio: "Generate Audio",
    generatingAudio: "Generating audio...",
    selectVoice: "Select Voice",
    male: "Male",
    female: "Female",
    downloadAudio: "Download Audio",
    exportToPDF: "Export to PDF",
    recording: "Recording...",
    editTranscription: "Edit transcription",
    playAudio: "Play",
    pauseAudio: "Pause",
    restartAudio: "Restart",
    error: "An error occurred",
    noMicrophoneAccess: "Microphone access denied. Please allow access to use this feature.",
    audioPlayer: "Audio Player",
    preparingDownload: "Preparing download...",
    downloadComplete: "Download complete",
    pdfExported: "PDF exported successfully",
    audioGenerationComplete: "Audio generated",
    savedRecordings: "Saved Recordings",
    newRecording: "New Recording",
    exportTranscriptionToPDF: "Export Transcription to PDF",
    exportSummaryToPDF: "Export Summary to PDF",
    downloadOriginalAudio: "Download Original Audio",
    downloadSummaryAudio: "Download Summary Audio",
    saveRecording: "Save Recording",
    savingRecording: "Saving...",
    recordingSaved: "Recording saved successfully",
    recordingSaveError: "Error saving recording",
    saveRecordingDesc: "Save this recording to your library",
    uploadAudio: "Upload File",
    uploadDescription: "Upload audio/text files for transcription and summary",
    uploading: "Uploading...",
    uploadedAudio: "Uploaded Audio",
    uploadError: "Error uploading audio",
    uploadSuccess: "Audio uploaded successfully",
    selectAudioFile: "Select audio file",
    or: "or",
    quickSummary: "Quick Summary",
    quickSummaryDesc: "Upload audio for instant summary",
    uploadQuickAudio: "Upload MP3 (25MB max)",
    summaryProcessing: "Processing summary...",
    summaryReady: "Summary ready. Click Save.",
    generateSummary: "Generate Summary",
    userUploadedAudio: "User uploaded audio",
    summaryDate: "Summary date",
    timeRemaining: "Time remaining",
    elapsedTime: "Elapsed",
    timeLimit: "Time limit reached. Recording stopped.",
    warningTimeApproaching: "Recording time limit approaching",
    finalMinuteWarning: "Final minute of recording time",
  },
  ar: {
    pageTitle: "تسجيل",
    recordLabel: "سجل صوتك",
    startRecording: "ابدأ التسجيل",
    stopRecording: "إيقاف التسجيل",
    processingRecording: "معالجة التسجيل...",
    transcribingAudio: "نسخ الصوت...",
    transcriptionLabel: "النص",
    copy: "نسخ",
    copiedToClipboard: "تم النسخ إلى الحافظة",
    summarize: "تلخيص",
    summarizingText: "جاري التلخيص...",
    summaryLabel: "الملخص",
    generateAudio: "إنشاء ملف صوتي",
    generatingAudio: "جاري إنشاء الصوت...",
    selectVoice: "اختر الصوت",
    male: "ذكر",
    female: "أنثى",
    downloadAudio: "تحميل الصوت",
    exportToPDF: "تصدير إلى PDF",
    recording: "جاري التسجيل...",
    editTranscription: "تحرير النص",
    playAudio: "تشغيل",
    pauseAudio: "إيقاف مؤقت",
    restartAudio: "إعادة تشغيل",
    error: "حدث خطأ",
    noMicrophoneAccess: "تم رفض الوصول إلى الميكروفون. الرجاء السماح بالوصول لاستخدام هذه الميزة.",
    audioPlayer: "مشغل الصوت",
    preparingDownload: "جاري تحضير التحميل...",
    downloadComplete: "اكتمل التحميل",
    pdfExported: "تم تصدير PDF بنجاح",
    audioGenerationComplete: "تم إنشاء الصوت",
    savedRecordings: "التسجيلات المحفوظة",
    newRecording: "تسجيل جديد",
    exportTranscriptionToPDF: "تصدير النص إلى PDF",
    exportSummaryToPDF: "تصدير الملخص إلى PDF",
    downloadOriginalAudio: "تحميل الصوت الأصلي",
    downloadSummaryAudio: "تحميل صوت الملخص",
    saveRecording: "حفظ التسجيل",
    savingRecording: "جاري الحفظ...",
    recordingSaved: "تم حفظ التسجيل بنجاح",
    recordingSaveError: "خطأ في حفظ التسجيل",
    saveRecordingDesc: "حفظ هذا التسجيل في مكتبتك",
    uploadAudio: "رفع ملف صوتي",
    uploadDescription: "رفع ملفات صوتية/نصية للنسخ والتلخيص",
    uploading: "جاري الرفع...",
    uploadedAudio: "تم رفع الملف الصوتي",
    uploadError: "خطأ في رفع الملف الصوتي",
    uploadSuccess: "تم رفع الملف الصوتي بنجاح",
    selectAudioFile: "اختر ملف صوتي",
    or: "أو",
    quickSummary: "ملخص سريع",
    quickSummaryDesc: "تحميل ملف صوتي للخلاصة الفورية",
    uploadQuickAudio: "تحميل MP3 (الحد الأقصى 25 ميغابايت)",
    summaryProcessing: "معالجة الملخص...",
    summaryReady: "الملخص جاهز. انقر على حفظ.",
    generateSummary: "إنشاء ملخص",
    userUploadedAudio: "تم تحميل الملف الصوتي من قبل المستخدم",
    summaryDate: "تاريخ الملخص",
    timeRemaining: "الوقت المتبقي",
    elapsedTime: "الوقت المنقضي",
    timeLimit: "تم الوصول إلى الحد الأقصى للتسجيل. تم إيقاف التسجيل.",
    warningTimeApproaching: "اقتراب نهاية مدة التسجيل",
    finalMinuteWarning: "الدقيقة الأخيرة من وقت التسجيل",
  }
};

const Tasjeel: React.FC = () => {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const navigate = useNavigate();
  const translationTexts = translations[language];

  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [remainingTime, setRemainingTime] = useState(MAX_RECORDING_TIME);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "processing" | "uploading">("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<"male" | "female">("male");
  const [activeTab, setActiveTab] = useState<"record" | "saved" | "quick">("record");
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  // Change from audioBase64 to direct audioBlob for better memory management
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [summaryAudioBlob, setSummaryAudioBlob] = useState<Blob | null>(null);
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  
  // Add state for storing the permanent summary audio URL from Supabase
  const [summaryAudioUrl, setSummaryAudioUrl] = useState<string | null>(null);
  
  // New state variables for quick summary flow
  const [quickAudioFile, setQuickAudioFile] = useState<File | null>(null);
  const [quickSummaryTitle, setQuickSummaryTitle] = useState<string>("");
  const [quickSummaryText, setQuickSummaryText] = useState<string>("");
  const [quickTranscript, setQuickTranscript] = useState<string>("");
  const [quickSummaryStatus, setQuickSummaryStatus] = useState<"idle" | "uploading" | "processing" | "ready">("idle");
  
  // New state for timer color indication
  const [timerColorState, setTimerColorState] = useState<"normal" | "warning" | "critical">("normal");
  const [showPulse, setShowPulse] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const summaryAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  
  // Effect to create audio player instance when audio blob is available
  useEffect(() => {
    if (audioBlob) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      
      const audioObjectUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioObjectUrl);
      audioPlayerRef.current = audio;
      
      // Cleanup function to revoke object URL when no longer needed
      return () => {
        URL.revokeObjectURL(audioObjectUrl);
      };
    }
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, [audioBlob]);

  // Effect for summary audio player
  useEffect(() => {
    if (summaryAudioBlob) {
      if (summaryAudioPlayerRef.current) {
        summaryAudioPlayerRef.current.pause();
      }
      
      const audioObjectUrl = URL.createObjectURL(summaryAudioBlob);
      const audio = new Audio(audioObjectUrl);
      summaryAudioPlayerRef.current = audio;
      
      return () => {
        URL.revokeObjectURL(audioObjectUrl);
      };
    }
    
    return () => {
      if (summaryAudioPlayerRef.current) {
        summaryAudioPlayerRef.current.pause();
        summaryAudioPlayerRef.current = null;
      }
    };
  }, [summaryAudioBlob]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Function to update timer color based on remaining time
  const updateTimerColor = (remaining: number) => {
    if (remaining <= WARNING_TIME_2) {
      // Final warning - red (1 minute or less)
      setTimerColorState("critical");
      if (!showPulse) {
        setShowPulse(true);
        // Show final minute warning
        toast(translationTexts.finalMinuteWarning);
      }
    } else if (remaining <= WARNING_TIME_1) {
      // Warning - yellow (5 minutes or less)
      setTimerColorState("warning");
    } else {
      // Normal - green (more than 5 minutes)
      setTimerColorState("normal");
    }
  };

  // Function to get timer background color
  const getTimerBackgroundColor = () => {
    switch (timerColorState) {
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "critical":
        return showPulse 
          ? "bg-red-100 text-red-800 animate-pulse" 
          : "bg-red-100 text-red-800";
      default:
        return "bg-green-100 text-green-800";
    }
  };
  
  // Start recording function with explicit codec options
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Define codec options with explicit mime type
      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      };
      
      let mediaRecorder;
      
      // Create MediaRecorder with codec options if supported
      try {
        mediaRecorder = new MediaRecorder(stream, options);
        console.log("Using preferred codec: audio/webm;codecs=opus");
      } catch (e) {
        // Fallback to browser default if preferred codec not supported
        console.log("Preferred codec not supported, using browser default");
        mediaRecorder = new MediaRecorder(stream);
        console.log("Using codec: ", mediaRecorder.mimeType);
      }
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = handleRecordingStopped;
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus("recording");
      setRecordingTime(0);
      setRemainingTime(MAX_RECORDING_TIME);
      setTimerColorState("normal");
      setShowPulse(false);
      
      // Start timer with time limit check
      let seconds = 0;
      timerRef.current = window.setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
        
        const remaining = MAX_RECORDING_TIME - seconds;
        setRemainingTime(remaining);
        
        // Update timer color based on remaining time
        updateTimerColor(remaining);
        
        // Show warning at 5 minutes remaining
        if (remaining === WARNING_TIME_1) {
          toast(translationTexts.warningTimeApproaching);
        }
        
        // Auto-stop recording when time limit is reached
        if (seconds >= MAX_RECORDING_TIME) {
          toast(translationTexts.timeLimit);
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast(translationTexts.noMicrophoneAccess);
    }
  };
  
  // Stop recording function
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
      setRecordingStatus("processing");
      setShowPulse(false);
    }
  };
  
  // Handle recording stopped event
  const handleRecordingStopped = async () => {
    try {
      console.log("Recording stopped, processing chunks...");
      
      // Get actual MIME type from the recorder if available
      const actualMimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
      console.log("Recorder MIME type:", actualMimeType);
      
      // Create blob with explicit MIME type
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
      console.log("Created audio blob:", {
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      const uniqueId = uuidv4();
      const fileName = `recording-${uniqueId}.webm`;
      
      // Use correct bucket name with underscores instead of spaces
      const bucketId = "tasjeel_recordings";
      
      // Use a path that includes the user ID if available
      const userPrefix = user?.id ? `${user.id}/` : '';
      const filePath = `${userPrefix}${fileName}`;
      
      console.log("Uploading recording to storage:", {
        bucket: bucketId,
        path: filePath,
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Upload to Supabase storage with explicit error handling
      const { data, error } = await supabase
        .storage
        .from(bucketId)
        .upload(filePath, audioBlob, {
          contentType: "audio/webm",
          cacheControl: "3600"
        });
        
      if (error) {
        console.error("Error uploading to storage:", error);
        
        // Show a user-friendly error message
        toast(error.message || "Failed to upload recording. Please try again.");
        setRecordingStatus("idle");
        return;
      }
      
      console.log("Storage upload successful:", data);
      
      // Get the public URL - works because bucket is set to public
      const { data: publicUrlData } = supabase
        .storage
        .from(bucketId)
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      console.log("Generated public URL:", audioUrl);
      setAudioUrl(audioUrl);
      setAudioBlob(audioBlob);
      
      // Generate a UUID for the recording but don't save to database yet
      const recordId = uuidv4();
      setCurrentRecordId(recordId);
      
      // Transcribe the audio
      await transcribeAudio(audioUrl);
      
    } catch (error) {
      console.error("Error processing recording:", error);
      toast(error.message || "An error occurred while processing the recording");
      setRecordingStatus("idle");
    }
  };
  
  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setRecordingStatus("uploading");
    setUploadingFile(true);
    
    try {
      // Upload the file
      const fileName = `upload-${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const userPrefix = user?.id ? `${user.id}/` : '';
      const filePath = `${userPrefix}${fileName}`;
      
      const { data, error } = await supabase
        .storage
        .from("tasjeel_recordings")
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: "3600"
        });
        
      if (error) throw error;
      
      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from("tasjeel_recordings")
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      setAudioUrl(audioUrl);
      
      // Create a blob from the file for local playback
      const fileBlob = new Blob([file], { type: file.type });
      setAudioBlob(fileBlob);
      
      // Transcribe the uploaded audio
      await transcribeAudio(audioUrl);
      
      toast(translationTexts.uploadSuccess);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast(translationTexts.uploadError);
      setRecordingStatus("idle");
    } finally {
      setUploadingFile(false);
      // Reset the input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };
  
  // Transcribe audio function with enhanced logging
  const transcribeAudio = async (audioUrl: string) => {
    try {
      setIsTranscribing(true);
      
      console.log('Tasjeel: Starting transcription process');
      console.log('Tasjeel: Audio URL for transcription:', audioUrl);
      
      console.log('Tasjeel: Calling transcribe-audio edge function');
      const startTime = Date.now();
      
      const response = await callEdgeFunctionWithRetry<{ transcript: string }>(
        "transcribe-audio",
        { 
          body: { audioUrl },
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const duration = Date.now() - startTime;
      console.log(`Tasjeel: Transcription completed in ${duration}ms`);
      console.log('Tasjeel: Transcription result received:', response);
      
      setTranscript(response.transcript);
      setRecordingStatus("idle");
    } catch (error) {
      console.error("Tasjeel: Error transcribing audio:", error);
      console.error("Tasjeel: Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      toast(error.message || "An error occurred while transcribing the audio");
      setRecordingStatus("idle");
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Summarize text function with improved error handling
  const summarizeText = async () => {
    try {
      if (!transcript.trim()) {
        return;
      }
      
      setIsSummarizing(true);
      
      console.log('Starting text summarization');
      console.log('Transcript length:', transcript.length);
      console.log('Current language:', language);
      
      const response = await callEdgeFunctionWithRetry<{ summary: string } | { error: string, details?: string }>(
        "summarize-text",
        { body: { transcript, language } }
      );
      
      console.log('Summarize response:', response);
      
      if ('error' in response) {
        throw new Error(`Summarization failed: ${response.error}${response.details ? ` - ${response.details}` : ''}`);
      }
      
      setSummary(response.summary);
    } catch (error) {
      console.error("Error summarizing text:", error);
      toast(translationTexts.error + ": " + (error.message || "An error occurred while summarizing the text"));
    } finally {
      setIsSummarizing(false);
    }
  };
  
  // Generate audio function - Updated to use Supabase storage URLs
  const generateAudio = async () => {
    try {
      if (!summary.trim()) {
        return;
      }
      
      setIsGeneratingAudio(true);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hxauxozopvpzpdygoqwf.supabase.co";
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU";
      
      // Create the request body - include a generated recordId for storage
      const tempRecordId = uuidv4();
      const requestBody = { 
        summary, 
        voice: selectedVoice,
        recordId: tempRecordId
      };
      
      console.log("Generating audio with request:", {
        summaryLength: summary.length,
        voice: selectedVoice,
        tempRecordId
      });
      
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate audio');
      }
      
      // Parse the response to get the storage URL
      const jsonData = await response.json();
      console.log("Audio generation response:", jsonData);
      
      if (jsonData.audioUrl) {
        // Store the permanent URL from Supabase
        setSummaryAudioUrl(jsonData.audioUrl);
        
        // Still fetch and prepare the audio for immediate playback
        const audioResponse = await fetch(jsonData.audioUrl);
        if (!audioResponse.ok) {
          throw new Error('Failed to fetch audio file from URL');
        }
        
        const audioData = await audioResponse.blob();
        setSummaryAudioBlob(audioData);
        
        // Create audio element for playback using the permanent URL
        const audio = new Audio(jsonData.audioUrl);
        summaryAudioPlayerRef.current = audio;
        
        toast(translationTexts.audioGenerationComplete);
      } else {
        throw new Error('No audio URL returned');
      }
    } catch (error) {
      console.error("Error generating audio:", error);
      toast(error.message || "An error occurred while generating the audio");
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // New function to save the complete recording to the database
  const saveRecording = async () => {
    if (!audioUrl) {
      return;
    }

    try {
      setIsSaving(true);
      
      // Important: Use the permanent storage URL for summary audio
      // instead of the temporary object URL from the audio player
      const finalSummaryAudioPath = summaryAudioUrl;
      
      if (!finalSummaryAudioPath) {
        console.warn("No permanent summary audio URL available");
      }

      // Save a new record with all the data we've collected
      await saveTasjeelRecord({
        original_recording_path: audioUrl,
        transcription: transcript,
        summary: summary,
        summary_audio_path: finalSummaryAudioPath,
        duration: recordingTime,
        title: new Date().toLocaleString(),
        saved: true, // Mark as explicitly saved
        source_type: 'recording' // Add missing source_type property
      });

      toast(translationTexts.recordingSaved);
      setActiveTab("saved"); // Switch to saved tab automatically
    } catch (error) {
      console.error("Error saving recording:", error);
      toast(translationTexts.recordingSaveError);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(translationTexts.copiedToClipboard);
  };
  
  // Play/pause original audio
  const togglePlayPause = () => {
    if (audioPlayerRef.current) {
      if (audioPlayerRef.current.paused) {
        audioPlayerRef.current.play();
      } else {
        audioPlayerRef.current.pause();
      }
    }
  };
  
  // Play/pause summary audio
  const toggleSummaryPlayPause = () => {
    if (summaryAudioPlayerRef.current) {
      if (summaryAudioPlayerRef.current.paused) {
        summaryAudioPlayerRef.current.play();
      } else {
        summaryAudioPlayerRef.current.pause();
      }
    }
  };
  
  // Restart audio playback
  const restartAudio = (isSummary: boolean = false) => {
    if (isSummary && summaryAudioPlayerRef.current) {
      summaryAudioPlayerRef.current.currentTime = 0;
      summaryAudioPlayerRef.current.play();
    } else if (!isSummary && audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play();
    }
  };
  
  // Download audio file - with option for summary audio
  const downloadAudio = (isSummary: boolean = false) => {
    const blob = isSummary ? summaryAudioBlob : audioBlob;
    if (blob) {
      toast(translationTexts.preparingDownload);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasjeel-${isSummary ? 'summary' : 'original'}-${new Date().toISOString().slice(0, 10)}.mp3`;
      link.click();
      
      // Clean up the URL object after the download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast(translationTexts.downloadComplete);
    }
  };
  
  // Export to PDF function
  const exportToPDF = async (isTranscription: boolean = false) => {
    try {
      const content = isTranscription ? transcript : summary;
      if (!content) return;
      
      const pdfBlob = await generatePDF({
        title: isTranscription ? translationTexts.transcriptionLabel : translationTexts.summaryLabel,
        content: { text: content },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          type: isTranscription ? "Tasjeel Transcription" : "Tasjeel Summary"
        },
        language: language as 'en' | 'ar'
      });
      
      // Create a download link for the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasjeel-${isTranscription ? 'transcription' : 'summary'}-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      
      // Clean up the URL object after the download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast(translationTexts.pdfExported);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast(error.message || "An error occurred while exporting to PDF");
    }
  };
  
  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };
  
  // New function to handle quick summary file selection
  const handleQuickFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type (MP3)
    if (!file.type.includes('audio/')) {
      toast(translationTexts.uploadError + ": " + "Please upload an audio file");
      return;
    }
    
    // Validate file size (25MB max)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (file.size > maxSize) {
      toast(translationTexts.uploadError + ": " + "File size exceeds 25MB limit");
      return;
    }
    
    setQuickAudioFile(file);
    setQuickSummaryStatus("uploading");
    toast(translationTexts.uploadSuccess);
  };
  
  // New function to process quick summary
  const processQuickSummary = async () => {
    if (!quickAudioFile) {
      toast(translationTexts.uploadError);
      return;
    }
    
    try {
      setQuickSummaryStatus("processing");
      
      // Create form data
      const formData = new FormData();
      formData.append('audio', quickAudioFile);
      
      // Use Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hxauxozopvpzpdygoqwf.supabase.co";
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU";
      
      const response = await fetch(`${supabaseUrl}/functions/v1/quick-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Processing failed');
      }
      
      const result = await response.json();
      
      setQuickSummaryTitle(result.title);
      setQuickSummaryText(result.summary);
      setQuickTranscript(result.transcript);
      setQuickSummaryStatus("ready");
      
    } catch (error) {
      console.error("Error processing quick summary:", error);
      toast(error.message || "An error occurred");
      setQuickSummaryStatus("idle");
    }
  };
  
  // New function to save quick summary - Updated to add placeholder for original_recording_path
  const saveQuickSummary = async () => {
    if (!quickSummaryTitle || !quickSummaryText) {
      toast(translationTexts.error);
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Save record with quick_summary source type and a placeholder for original_recording_path
      await saveTasjeelRecord({
        title: quickSummaryTitle,
        summary: quickSummaryText,
        transcription: quickTranscript,
        original_recording_path: "placeholder_for_quick_summary", // Added placeholder instead of null
        duration: null,
        summary_audio_path: null,
        saved: true,
        source_type: 'quick_summary'
      });
      
      toast(translationTexts.recordingSaved);
      setActiveTab("saved"); // Switch to saved tab automatically
      
      // Reset quick summary states
      setQuickAudioFile(null);
      setQuickSummaryTitle("");
      setQuickSummaryText("");
      setQuickTranscript("");
      setQuickSummaryStatus("idle");
      
      if (quickFileInputRef.current) {
        quickFileInputRef.current.value = "";
      }
      
    } catch (error) {
      console.error("Error saving quick summary:", error);
      toast(translationTexts.recordingSaveError);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <PageContainer title={translationTexts.pageTitle} showBackButton={true} showHeader={false}>
      <div className="container py-4 space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "record" | "saved" | "quick")}>
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              {translationTexts.newRecording}
            </TabsTrigger>
            <TabsTrigger value="quick" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              {translationTexts.quickSummary}
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {translationTexts.savedRecordings}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="space-y-6">
            {/* Recording section */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">{translationTexts.recordLabel}</h2>
                
                {recordingStatus === "recording" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                        <Mic className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    
                    {/* Updated timer display with both elapsed and remaining time */}
                    <div className="flex justify-between items-center">
                      <div className="text-center flex-1">
                        <div className="text-sm text-muted-foreground">{translationTexts.elapsedTime}</div>
                        <div className="text-xl font-bold">{formatTime(recordingTime)}</div>
                      </div>
                      
                      <div className="mx-2 h-8 w-px bg-gray-200"></div>
                      
                      <div className="text-center flex-1">
                        <div className="text-sm text-muted-foreground">{translationTexts.timeRemaining}</div>
                        <div className={`text-xl font-bold px-3 py-1 rounded-md ${getTimerBackgroundColor()}`}>
                          {formatTime(remainingTime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-center text-muted-foreground">{translationTexts.recording}</div>
                    
                    <Button 
                      variant="destructive" 
                      className="w-full" 
                      onClick={stopRecording}
                    >
                      <StopCircle className="mr-2" />
                      {translationTexts.stopRecording}
                    </Button>
                  </div>
                ) : recordingStatus === "processing" || recordingStatus === "uploading" ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <p className="mt-4">
                      {recordingStatus === "uploading" 
                        ? translationTexts.uploading 
                        : (isTranscribing ? translationTexts.transcribingAudio : translationTexts.processingRecording)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Button 
                      className="w-full" 
                      onClick={startRecording}
                    >
                      <Mic className="mr-2" />
                      {translationTexts.startRecording}
                    </Button>
                    
                    {/* Recording limit info box */}
                    <div className="flex items-center p-3 rounded-md bg-blue-50 text-blue-800">
                      <Timer className="h-5 w-5 mr-2" />
                      <span className="text-sm">
                        {language === 'en' 
                          ? "Maximum recording time: 30 minutes" 
                          : "الحد الأقصى لمدة التسجيل: 30 دقيقة"}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Transcription section */}
            {transcript && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{translationTexts.transcriptionLabel}</h2>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(transcript)}
                      >
                        <ClipboardCopy className="h-4 w-4 mr-1" />
                        {translationTexts.copy}
                      </Button>
                      
                      {/* Export transcription to PDF button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => exportToPDF(true)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea 
                    value={transcript} 
                    onChange={(e) => setTranscript(e.target.value)}
                    className="min-h-[200px] mb-4"
                    placeholder={translationTexts.editTranscription}
                  />
                  
                  {/* Original audio player */}
                  {audioBlob && (
                    <div className="flex flex-col space-y-3 mb-4">
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">{translationTexts.audioPlayer}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadAudio(false)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          {translationTexts.downloadOriginalAudio}
                        </Button>
                      </div>
                      <div className="flex justify-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={togglePlayPause}
                        >
                          <PlayCircle className="h-6 w-6" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            if (audioPlayerRef.current) {
                              audioPlayerRef.current.pause();
                            }
                          }}
                        >
                          <PauseCircle className="h-6 w-6" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => restartAudio(false)}
                        >
                          <RefreshCw className="h-6 w-6" />
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Reminder text above Summarize button */}
                  <div className="flex items-center gap-2 p-3 mb-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                      {t("reviewTranscriptReminder", language)}
                    </span>
                  </div>
                  
                  <Button
                    className="w-full"
                    onClick={summarizeText}
                    disabled={isSummarizing || !transcript.trim()}
                  >
                    {isSummarizing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {translationTexts.summarizingText}
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        {translationTexts.summarize}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
            
            {/* Summary section */}
            {summary && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{translationTexts.summaryLabel}</h2>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(summary)}
                      >
                        <ClipboardCopy className="h-4 w-4 mr-1" />
                        {translationTexts.copy}
                      </Button>
                      
                      {/* Export summary to PDF button */}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => exportToPDF(false)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea 
                    value={summary} 
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-[200px] mb-4"
                  />
                  
                  <div className="space-y-4">
                    <div className="flex flex-col space-y-2">
                      <label className="font-medium">{translationTexts.selectVoice}</label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedVoice === "male" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setSelectedVoice("male")}
                        >
                          {translationTexts.male}
                        </Button>
                        <Button
                          variant={selectedVoice === "female" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setSelectedVoice("female")}
                        >
                          {translationTexts.female}
                        </Button>
                      </div>
                    </div>
                    
                    {/* Reminder text above Generate Audio button */}
                    <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md">
                      <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {t("reviewSummaryReminder", language)}
                      </span>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={generateAudio}
                      disabled={isGeneratingAudio || !summary.trim()}
                    >
                      {isGeneratingAudio ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {translationTexts.generatingAudio}
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          {translationTexts.generateAudio}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Save Record button - only show when we have audio generated */}
            {summaryAudioBlob && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold">{translationTexts.saveRecordingDesc}</h3>
                      <p className="text-sm text-muted-foreground">
                        {translationTexts.saveRecordingDesc}
                      </p>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={saveRecording}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {translationTexts.savingRecording}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {translationTexts.saveRecording}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="quick" className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-2">{translationTexts.quickSummary}</h2>
                <p className="text-sm text-muted-foreground mb-4">{translationTexts.quickSummaryDesc}</p>
                
                {quickSummaryStatus === "idle" && (
                  <div>
                    <input
                      type="file"
                      ref={quickFileInputRef}
                      accept="audio/*"
                      className="hidden"
                      onChange={handleQuickFileSelect}
                    />
                    <Button 
                      className="w-full"
                      variant="outline"
                      onClick={() => quickFileInputRef.current?.click()}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {translationTexts.uploadQuickAudio}
                    </Button>
                  </div>
                )}
                
                {quickSummaryStatus === "uploading" && quickAudioFile && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{quickAudioFile.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(quickAudioFile.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={processQuickSummary}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      {translationTexts.generateSummary}
                    </Button>
                  </div>
                )}
                
                {quickSummaryStatus === "processing" && (
                  <div className="flex flex-col items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <p className="mt-4">{translationTexts.summaryProcessing}</p>
                  </div>
                )}
                
                {quickSummaryStatus === "ready" && quickSummaryTitle && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-lg">{quickSummaryTitle}</h3>
                      <p className="text-xs text-muted-foreground">
                        {translationTexts.summaryDate}: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
                      </p>
                    </div>
                    
                    <div className="bg-muted p-3 rounded-md">
                      <p>{translationTexts.summaryReady}</p>
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={saveQuickSummary}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {translationTexts.savingRecording}
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          {translationTexts.saveRecording}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="saved">
            <SavedRecordings />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
};

export default Tasjeel;
