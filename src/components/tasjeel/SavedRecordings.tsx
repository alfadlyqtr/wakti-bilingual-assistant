
import React, { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TasjeelRecord } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-helper";
import { FileText, PlayCircle, Download, Trash, Volume2 } from "lucide-react";
import { generatePDF } from "@/utils/pdfUtils";

// Translations
const translations = {
  en: {
    noRecordings: "No saved recordings found",
    loadingRecordings: "Loading saved recordings...",
    playOriginalAudio: "Play Original",
    playSummaryAudio: "Play Summary",
    viewTranscription: "View Transcription",
    viewSummary: "View Summary",
    downloadOriginalAudio: "Download Original Audio",
    downloadSummaryAudio: "Download Summary Audio",
    exportTranscriptionToPDF: "Export Transcription",
    exportSummaryToPDF: "Export Summary",
    deleteRecording: "Delete",
    recordingDeleted: "Recording deleted",
    errorDeletingRecording: "Error deleting recording",
    errorLoadingRecordings: "Error loading recordings",
    recordingDate: "Date",
    duration: "Duration",
    transcription: "Transcription",
    summary: "Summary",
    audio: "Audio",
    actions: "Actions",
    seconds: "seconds"
  },
  ar: {
    noRecordings: "لم يتم العثور على تسجيلات محفوظة",
    loadingRecordings: "جارٍ تحميل التسجيلات المحفوظة...",
    playOriginalAudio: "تشغيل الأصلي",
    playSummaryAudio: "تشغيل الملخص",
    viewTranscription: "عرض النص",
    viewSummary: "عرض الملخص",
    downloadOriginalAudio: "تنزيل الصوت الأصلي",
    downloadSummaryAudio: "تنزيل صوت الملخص",
    exportTranscriptionToPDF: "تصدير النص",
    exportSummaryToPDF: "تصدير الملخص",
    deleteRecording: "حذف",
    recordingDeleted: "تم حذف التسجيل",
    errorDeletingRecording: "خطأ في حذف التسجيل",
    errorLoadingRecordings: "خطأ في تحميل التسجيلات",
    recordingDate: "التاريخ",
    duration: "المدة",
    transcription: "النص",
    summary: "الملخص",
    audio: "الصوت",
    actions: "الإجراءات",
    seconds: "ثواني"
  }
};

const SavedRecordings: React.FC = () => {
  const { theme, language } = useTheme();
  const { user } = useAuth();
  const t = translations[language];

  const [recordings, setRecordings] = useState<TasjeelRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState<boolean>(false);
  const [currentlyPlayingAudio, setCurrentlyPlayingAudio] = useState<HTMLAudioElement | null>(null);

  // Load saved recordings
  useEffect(() => {
    if (user) {
      loadSavedRecordings();
    }
  }, [user]);

  // Clean up any playing audio when component unmounts
  useEffect(() => {
    return () => {
      if (currentlyPlayingAudio) {
        currentlyPlayingAudio.pause();
        setCurrentlyPlayingAudio(null);
      }
    };
  }, []);

  const loadSavedRecordings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("tasjeel_records")
        .select("*")
        .eq("user_id", user?.id)
        .eq("saved", true)  // Only select saved records
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }
      
      setRecordings(data || []);
    } catch (error) {
      console.error("Error loading saved recordings:", error);
      toast(t.errorLoadingRecordings);
    } finally {
      setLoading(false);
    }
  };

  // Format time function
  const formatTime = (seconds: number | null): string => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Format date function
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(language === "ar" ? "ar-SA" : undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Play audio function
  const playAudio = (url: string, recordingId: string, isOriginal: boolean = true) => {
    // Stop any currently playing audio
    if (currentlyPlayingAudio) {
      currentlyPlayingAudio.pause();
    }

    // Create and play new audio
    const audio = new Audio(url);
    audio.onended = () => {
      setPlayingRecordingId(null);
      setIsPlayingOriginal(false);
      setCurrentlyPlayingAudio(null);
    };
    
    audio.play().catch(err => {
      console.error("Error playing audio:", err);
      toast(err.message);
    });
    
    setPlayingRecordingId(recordingId);
    setIsPlayingOriginal(isOriginal);
    setCurrentlyPlayingAudio(audio);
  };

  // Delete recording function
  const deleteRecording = async (id: string) => {
    try {
      const { error } = await supabase
        .from("tasjeel_records")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
      
      // Refresh the recordings list
      setRecordings(recordings.filter(rec => rec.id !== id));
      toast(t.recordingDeleted);
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast(t.errorDeletingRecording);
    }
  };

  // Download audio function
  const downloadAudio = (url: string, isSummary: boolean = false, title: string | null = null) => {
    const link = document.createElement("a");
    link.href = url;
    const fileName = `tasjeel-${isSummary ? 'summary' : 'original'}-${title || new Date().toISOString().slice(0, 10)}.mp3`;
    link.download = fileName;
    link.click();
  };

  // Export to PDF function
  const exportToPDF = async (content: string | null, isTranscription: boolean = true, title: string | null = null) => {
    if (!content) return;
    
    try {
      const pdfBlob = await generatePDF({
        title: isTranscription ? t.transcription : t.summary,
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
      link.download = `tasjeel-${isTranscription ? 'transcription' : 'summary'}-${title || new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      
      // Clean up the URL object after the download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">{t.loadingRecordings}</p>
      </div>
    );
  }

  if (recordings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">{t.noRecordings}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recordings.map(recording => (
        <Card key={recording.id} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">{recording.title || formatDate(recording.created_at)}</h3>
                <span className="text-sm text-muted-foreground">
                  {recording.duration ? `${recording.duration} ${t.seconds}` : ''}
                </span>
              </div>
              
              <Separator />
              
              {/* Audio Controls */}
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-4">
                {recording.original_recording_path && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => playAudio(recording.original_recording_path, recording.id, true)}
                    className="flex items-center"
                  >
                    {playingRecordingId === recording.id && isPlayingOriginal ? 
                      <span className="flex items-center">◼ {t.playOriginalAudio}</span> : 
                      <><PlayCircle className="mr-1 h-4 w-4" /> {t.playOriginalAudio}</>
                    }
                  </Button>
                )}
                
                {recording.summary_audio_path && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => playAudio(recording.summary_audio_path, recording.id, false)}
                    className="flex items-center"
                  >
                    {playingRecordingId === recording.id && !isPlayingOriginal ? 
                      <span className="flex items-center">◼ {t.playSummaryAudio}</span> : 
                      <><Volume2 className="mr-1 h-4 w-4" /> {t.playSummaryAudio}</>
                    }
                  </Button>
                )}
              </div>
              
              <Separator />
              
              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-2">
                {recording.transcription && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToPDF(recording.transcription, true, recording.title)}
                  >
                    <FileText className="mr-1 h-4 w-4" /> {t.exportTranscriptionToPDF}
                  </Button>
                )}
                
                {recording.summary && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToPDF(recording.summary, false, recording.title)}
                  >
                    <FileText className="mr-1 h-4 w-4" /> {t.exportSummaryToPDF}
                  </Button>
                )}
                
                {recording.original_recording_path && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadAudio(recording.original_recording_path, false, recording.title)}
                  >
                    <Download className="mr-1 h-4 w-4" /> {t.downloadOriginalAudio}
                  </Button>
                )}
                
                {recording.summary_audio_path && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadAudio(recording.summary_audio_path, true, recording.title)}
                  >
                    <Download className="mr-1 h-4 w-4" /> {t.downloadSummaryAudio}
                  </Button>
                )}
                
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => deleteRecording(recording.id)}
                >
                  <Trash className="mr-1 h-4 w-4" /> {t.deleteRecording}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SavedRecordings;
