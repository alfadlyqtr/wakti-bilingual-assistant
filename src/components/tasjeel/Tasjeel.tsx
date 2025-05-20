import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, callEdgeFunctionWithRetry, saveTasjeelRecord } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast-helper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generatePDF } from "@/utils/pdfUtils";
import { Logo3D } from "@/components/Logo3D";
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
  History
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";
import PreviousRecordings from "./PreviousRecordings";

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
    previousRecordings: "Previous Recordings",
    newRecording: "New Recording",
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
    previousRecordings: "التسجيلات السابقة",
    newRecording: "تسجيل جديد",
  }
};

const Tasjeel: React.FC = () => {
  const { user } = useAuth();
  const { theme, language } = useTheme();
  const navigate = useNavigate();
  const t = translations[language];

  // State variables
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "processing">("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<"male" | "female">("male");
  const [activeTab, setActiveTab] = useState<"record" | "history">("record");
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  // Change from audioBase64 to direct audioBlob for better memory management
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
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
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);
  
  // Start recording function
  const startRecording = async () => {
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
      
      mediaRecorder.onstop = handleRecordingStopped;
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStatus("recording");
      
      // Start timer
      let seconds = 0;
      timerRef.current = window.setInterval(() => {
        seconds++;
        setRecordingTime(seconds);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast(t.noMicrophoneAccess);
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
    }
  };
  
  // Handle recording stopped event
  const handleRecordingStopped = async () => {
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const uniqueId = uuidv4();
      const fileName = `recording-${uniqueId}.webm`;
      
      // Use a path that doesn't rely on user authentication
      const filePath = `recordings/${fileName}`;
      
      console.log("Uploading recording to storage:", {
        bucket: "tasjeel_recordings",
        path: filePath,
        size: audioBlob.size,
        type: audioBlob.type
      });
      
      // Upload to Supabase storage with explicit error handling
      const { data, error } = await supabase
        .storage
        .from("tasjeel_recordings")
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
        .from("tasjeel_recordings")
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      console.log("Generated public URL:", audioUrl);
      setAudioUrl(audioUrl);
      
      // Create a new record ID and save initial data
      const recordId = uuidv4();
      setCurrentRecordId(recordId);
      
      try {
        // Save initial record
        await saveTasjeelRecord({
          original_recording_path: audioUrl,
          duration: recordingTime,
          title: new Date().toLocaleString(),
          transcription: null,
          summary: null,
          summary_audio_path: null
        });
      } catch (dbError) {
        console.error("Error saving initial record:", dbError);
        // Continue with transcription even if DB save fails
      }
      
      // Transcribe the audio
      await transcribeAudio(audioUrl, recordId);
      
    } catch (error) {
      console.error("Error processing recording:", error);
      toast(error.message || "An error occurred while processing the recording");
      setRecordingStatus("idle");
    }
  };
  
  // Transcribe audio function with enhanced logging
  const transcribeAudio = async (audioUrl: string, recordId?: string) => {
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
      
      // Update record with transcription if we have a record ID
      if (recordId) {
        try {
          await supabase
            .from('tasjeel_records')
            .update({ transcription: response.transcript })
            .eq('id', recordId);
        } catch (dbError) {
          console.error("Error updating record with transcription:", dbError);
        }
      }
      
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
      
      // Update record with summary if we have a record ID
      if (currentRecordId) {
        try {
          await supabase
            .from('tasjeel_records')
            .update({ summary: response.summary })
            .eq('id', currentRecordId);
        } catch (dbError) {
          console.error("Error updating record with summary:", dbError);
        }
      }
    } catch (error) {
      console.error("Error summarizing text:", error);
      toast(t.error + ": " + (error.message || "An error occurred while summarizing the text"));
    } finally {
      setIsSummarizing(false);
    }
  };
  
  // Generate audio function - Updated to save to storage
  const generateAudio = async () => {
    try {
      if (!summary.trim()) {
        return;
      }
      
      setIsGeneratingAudio(true);
      
      // We'll now get the audio file directly as a blob and save it to storage if we have a record ID
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://hxauxozopvpzpdygoqwf.supabase.co";
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4YXV4b3pvcHZwenBkeWdvcXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwNzAxNjQsImV4cCI6MjA2MjY0NjE2NH0.-4tXlRVZZCx-6ehO9-1lxLsJM3Kmc1sMI8hSKwV9UOU";
      
      // Create the request body - only add recordId if it exists
      const requestBody: { 
        summary: string; 
        voice: "male" | "female";
        recordId?: string;
      } = { 
        summary, 
        voice: selectedVoice
      };
      
      if (currentRecordId) {
        requestBody.recordId = currentRecordId;
      }
      
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
      
      // Check content type to handle JSON or binary response
      const contentType = response.headers.get('Content-Type');
      
      if (contentType && contentType.includes('application/json')) {
        // This is a JSON response with URL
        const jsonData = await response.json();
        if (jsonData.audioUrl) {
          // Create audio element for playback using the URL
          const audio = new Audio(jsonData.audioUrl);
          audioPlayerRef.current = audio;
        } else {
          throw new Error('No audio URL returned');
        }
      } else {
        // Get the audio as a blob directly
        const audioData = await response.blob();
        setAudioBlob(audioData);
        
        // Create an object URL for playback
        const audioObjectUrl = URL.createObjectURL(audioData);
        const audio = new Audio(audioObjectUrl);
        audioPlayerRef.current = audio;
      }
      
      toast(t.audioGenerationComplete);
    } catch (error) {
      console.error("Error generating audio:", error);
      toast(error.message || "An error occurred while generating the audio");
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(t.copiedToClipboard);
  };
  
  // Play/pause audio
  const togglePlayPause = () => {
    if (audioPlayerRef.current) {
      if (audioPlayerRef.current.paused) {
        audioPlayerRef.current.play();
      } else {
        audioPlayerRef.current.pause();
      }
    }
  };
  
  // Restart audio playback
  const restartAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.play();
    }
  };
  
  // Download audio file - Updated to use Blob
  const downloadAudio = () => {
    if (audioBlob) {
      toast(t.preparingDownload);
      
      const url = URL.createObjectURL(audioBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasjeel-summary-${new Date().toISOString().slice(0, 10)}.mp3`;
      link.click();
      
      // Clean up the URL object after the download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast(t.downloadComplete);
    }
  };
  
  // Export to PDF function
  const exportToPDF = async () => {
    try {
      await generatePDF({
        title: t.summaryLabel,
        content: { text: summary },
        metadata: {
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          type: "Tasjeel Summary"
        },
        language: language as 'en' | 'ar'
      });
      
      toast(t.pdfExported);
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
  
  return (
    <PageContainer title={t.pageTitle} showBackButton={true}>
      <div className="container py-4 space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "record" | "history")}>
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="record" className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              {t.newRecording}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              {t.previousRecordings}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="record" className="space-y-6">
            {/* Recording section */}
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">{t.recordLabel}</h2>
                
                {recordingStatus === "recording" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center animate-pulse">
                        <Mic className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold">{formatTime(recordingTime)}</div>
                      <div className="text-sm text-muted-foreground">{t.recording}</div>
                    </div>
                    <Button 
                      variant="destructive" 
                      className="w-full" 
                      onClick={stopRecording}
                    >
                      <StopCircle className="mr-2" />
                      {t.stopRecording}
                    </Button>
                  </div>
                ) : recordingStatus === "processing" ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin" />
                    <p className="mt-4">{isTranscribing ? t.transcribingAudio : t.processingRecording}</p>
                  </div>
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={startRecording}
                  >
                    <Mic className="mr-2" />
                    {t.startRecording}
                  </Button>
                )}
              </CardContent>
            </Card>
            
            {/* Transcription section */}
            {transcript && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">{t.transcriptionLabel}</h2>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => copyToClipboard(transcript)}
                      >
                        <ClipboardCopy className="h-4 w-4 mr-1" />
                        {t.copy}
                      </Button>
                    </div>
                  </div>
                  
                  <Textarea 
                    value={transcript} 
                    onChange={(e) => setTranscript(e.target.value)}
                    className="min-h-[200px] mb-4"
                    placeholder={t.editTranscription}
                  />
                  
                  <Button
                    className="w-full"
                    onClick={summarizeText}
                    disabled={isSummarizing || !transcript.trim()}
                  >
                    {isSummarizing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        {t.summarizingText}
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        {t.summarize}
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
                    <h2 className="text-lg font-semibold">{t.summaryLabel}</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(summary)}
                    >
                      <ClipboardCopy className="h-4 w-4 mr-1" />
                      {t.copy}
                    </Button>
                  </div>
                  
                  <Textarea 
                    value={summary} 
                    onChange={(e) => setSummary(e.target.value)}
                    className="min-h-[200px] mb-4"
                  />
                  
                  <div className="space-y-4">
                    <div className="flex flex-col space-y-2">
                      <label className="font-medium">{t.selectVoice}</label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedVoice === "male" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setSelectedVoice("male")}
                        >
                          {t.male}
                        </Button>
                        <Button
                          variant={selectedVoice === "female" ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setSelectedVoice("female")}
                        >
                          {t.female}
                        </Button>
                      </div>
                    </div>
                    
                    <Button
                      className="w-full"
                      onClick={generateAudio}
                      disabled={isGeneratingAudio || !summary.trim()}
                    >
                      {isGeneratingAudio ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          {t.generatingAudio}
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          {t.generateAudio}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Audio player section */}
            {audioBlob && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-lg font-semibold mb-4">{t.audioPlayer}</h2>
                  
                  <div className="flex flex-col space-y-4">
                    <div className="flex justify-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={togglePlayPause}
                      >
                        <PlayCircle className="h-6 w-6" />
                        <span className="sr-only">{t.playAudio}</span>
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
                        <span className="sr-only">{t.pauseAudio}</span>
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={restartAudio}
                      >
                        <RefreshCw className="h-6 w-6" />
                        <span className="sr-only">{t.restartAudio}</span>
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={downloadAudio}>
                        <Download className="mr-2 h-4 w-4" />
                        {t.downloadAudio}
                      </Button>
                      
                      <Button onClick={exportToPDF} variant="secondary">
                        <FileText className="mr-2 h-4 w-4" />
                        {t.exportToPDF}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="history">
            <PreviousRecordings />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
};

export default Tasjeel;
