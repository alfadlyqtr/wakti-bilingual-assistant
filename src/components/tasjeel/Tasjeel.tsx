import React, { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, callEdgeFunctionWithRetry } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast-helper";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/PageContainer";
import { Separator } from "@/components/ui/separator";
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
  Volume2
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";

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
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  
  // Effect to create audio player instance when audio is generated
  useEffect(() => {
    if (audioBase64) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      
      const audioData = `data:audio/mp3;base64,${audioBase64}`;
      const audio = new Audio(audioData);
      audioPlayerRef.current = audio;
    }
    
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    };
  }, [audioBase64]);
  
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
      toast({
        description: t.noMicrophoneAccess,
      });
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
      const file = new File([audioBlob], `recording-${uuidv4()}.webm`, { type: "audio/webm" });
      
      // Upload to Supabase storage
      const { data, error } = await supabase
        .storage
        .from("tasjeel_recordings")
        .upload(`${user?.id}/${file.name}`, file);
        
      if (error) {
        throw error;
      }
      
      // Get the public URL
      const { data: publicUrlData } = supabase
        .storage
        .from("tasjeel_recordings")
        .getPublicUrl(`${user?.id}/${file.name}`);
      
      const audioUrl = publicUrlData.publicUrl;
      setAudioUrl(audioUrl);
      
      // Transcribe the audio
      await transcribeAudio(audioUrl);
      
    } catch (error) {
      console.error("Error processing recording:", error);
      toast({
        description: error.message || "An error occurred while processing the recording",
      });
      setRecordingStatus("idle");
    }
  };
  
  // Transcribe audio function
  const transcribeAudio = async (audioUrl: string) => {
    try {
      setIsTranscribing(true);
      
      const { transcript: result } = await callEdgeFunctionWithRetry<{ transcript: string }>(
        "transcribe-audio",
        { body: { audioUrl } }
      );
      
      setTranscript(result);
      setRecordingStatus("idle");
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast({
        description: error.message || "An error occurred while transcribing the audio",
      });
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Summarize text function
  const summarizeText = async () => {
    try {
      if (!transcript.trim()) {
        return;
      }
      
      setIsSummarizing(true);
      
      const { summary: result } = await callEdgeFunctionWithRetry<{ summary: string }>(
        "summarize-text",
        { body: { transcript, language } }
      );
      
      setSummary(result);
    } catch (error) {
      console.error("Error summarizing text:", error);
      toast({
        description: error.message || "An error occurred while summarizing the text",
      });
    } finally {
      setIsSummarizing(false);
    }
  };
  
  // Generate audio function
  const generateAudio = async () => {
    try {
      if (!summary.trim()) {
        return;
      }
      
      setIsGeneratingAudio(true);
      
      const { audio, contentType } = await callEdgeFunctionWithRetry<{ audio: string, contentType: string }>(
        "generate-speech",
        { body: { summary, voice: selectedVoice } }
      );
      
      setAudioBase64(audio);
      toast({
        description: t.audioGenerationComplete,
      });
    } catch (error) {
      console.error("Error generating audio:", error);
      toast({
        description: error.message || "An error occurred while generating the audio",
      });
    } finally {
      setIsGeneratingAudio(false);
    }
  };
  
  // Copy to clipboard function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      description: t.copiedToClipboard,
      duration: 2000,
    });
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
  
  // Download audio file
  const downloadAudio = () => {
    if (audioBase64) {
      toast({
        description: t.preparingDownload,
        duration: 2000,
      });
      
      const audioData = `data:audio/mp3;base64,${audioBase64}`;
      const link = document.createElement("a");
      link.href = audioData;
      link.download = `tasjeel-summary-${new Date().toISOString().slice(0, 10)}.mp3`;
      link.click();
      
      toast({
        description: t.downloadComplete,
        duration: 2000,
      });
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
      
      toast({
        description: t.pdfExported,
        duration: 2000,
      });
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast({
        description: error.message || "An error occurred while exporting to PDF",
      });
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
        {audioBase64 && (
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
      </div>
    </PageContainer>
  );
};

export default Tasjeel;
