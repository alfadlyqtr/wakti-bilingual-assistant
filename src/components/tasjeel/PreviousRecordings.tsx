
import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getTasjeelRecords, deleteTasjeelRecord } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { generatePDF } from "@/utils/pdfUtils";
import {
  Download,
  Trash2,
  PlayCircle,
  PauseCircle,
  Clock,
  RefreshCw,
  FileText,
  Volume2
} from "lucide-react";
import { TasjeelRecord } from "./types";

// Translations for PreviousRecordings component
const translations = {
  en: {
    previousRecordings: "Previous Recordings",
    noRecordings: "No recordings found",
    recorded: "Recorded",
    duration: "Duration",
    delete: "Delete",
    play: "Play",
    pause: "Pause",
    summary: "Summary",
    audio: "Audio Summary",
    downloadSummaryAudio: "Download Audio",
    exportToPDF: "Export to PDF",
    confirmDelete: "Are you sure you want to delete this recording?",
    recordingDetails: "Recording Details",
    noSummary: "No summary available",
    loading: "Loading recordings...",
    deleteSuccess: "Recording deleted successfully",
    deleteError: "Error deleting recording",
    pdfExported: "PDF exported successfully",
    seconds: "sec",
  },
  ar: {
    previousRecordings: "التسجيلات السابقة",
    noRecordings: "لم يتم العثور على تسجيلات",
    recorded: "تم التسجيل في",
    duration: "المدة",
    delete: "حذف",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    summary: "الملخص",
    audio: "الملخص الصوتي",
    downloadSummaryAudio: "تحميل الملخص الصوتي",
    exportToPDF: "تصدير إلى PDF",
    confirmDelete: "هل أنت متأكد أنك تريد حذف هذا التسجيل؟",
    recordingDetails: "تفاصيل التسجيل",
    noSummary: "لا يوجد ملخص متاح",
    loading: "جاري تحميل التسجيلات...",
    deleteSuccess: "تم حذف التسجيل بنجاح",
    deleteError: "خطأ في حذف التسجيل",
    pdfExported: "تم تصدير PDF بنجاح",
    seconds: "ثانية",
  }
};

// Format seconds to MM:SS
const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const RecordingDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  record: TasjeelRecord | null;
  onDelete: (id: string) => Promise<void>;
  t: any;
  language: string;
}> = ({ isOpen, onClose, record, onDelete, t, language }) => {
  const [audioPlaying, setAudioPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset audio state when dialog closes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setAudioPlaying(false);
    }
  }, [isOpen]);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const handleExportToPDF = async () => {
    if (!record) return;
    
    try {
      // Generate PDF with focus on the summary
      const pdfBlob = await generatePDF({
        title: record.title || "Tasjeel Recording",
        content: record.summary || "No summary available",
        metadata: {
          createdAt: record.created_at,
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          type: "Tasjeel Summary"
        },
        language: language as 'en' | 'ar'
      });
      
      // Create a download link and trigger it
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tasjeel-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
      link.click();
      
      // Clean up the URL object after the download starts
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      toast(t.pdfExported);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast(error.message || "An error occurred while exporting to PDF");
    }
  };

  const handleDownloadSummaryAudio = () => {
    if (!record || !record.summary_audio_path) return;
    
    const link = document.createElement("a");
    link.href = record.summary_audio_path;
    link.download = `summary-audio-${record.id.slice(0, 8)}.mp3`;
    link.click();
  };

  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>
            {t.recordingDetails} - {record.title || format(new Date(record.created_at), "yyyy-MM-dd HH:mm")}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-1 text-sm">
              <Clock className="w-4 h-4" />
              {t.recorded}: {format(new Date(record.created_at), "yyyy-MM-dd HH:mm")}
            </div>
            <div className="flex items-center gap-1 text-sm">
              {record.duration && (
                <>{t.duration}: {formatDuration(record.duration)} {t.seconds}</>
              )}
            </div>
          </div>
          
          {/* Always show summary as the primary content */}
          <div className="mb-6">
            <h3 className="font-medium mb-2">{t.summary}</h3>
            <div className="text-sm whitespace-pre-wrap bg-muted/30 p-4 rounded-md">
              {record.summary || t.noSummary}
            </div>
          </div>
          
          {/* Audio player for summary audio */}
          {record.summary_audio_path && (
            <div className="flex flex-col items-center justify-center py-4">
              <audio 
                ref={audioRef} 
                src={record.summary_audio_path} 
                onPlay={() => setAudioPlaying(true)}
                onPause={() => setAudioPlaying(false)}
                onEnded={() => setAudioPlaying(false)}
                className="hidden"
              />
              <Button 
                variant="outline" 
                size="lg"
                className="h-16 w-16 rounded-full mb-4" 
                onClick={handlePlayPause}
              >
                {audioPlaying ? (
                  <PauseCircle className="h-10 w-10" />
                ) : (
                  <PlayCircle className="h-10 w-10" />
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                {audioPlaying ? t.pause : t.play}
              </span>
            </div>
          )}
        </div>
        
        <Separator />
        
        <div className="p-4 flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">            
            {record.summary_audio_path && (
              <Button 
                variant="outline" 
                onClick={handleDownloadSummaryAudio}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                {t.downloadSummaryAudio}
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleExportToPDF}
            >
              <FileText className="mr-2 h-4 w-4" />
              {t.exportToPDF}
            </Button>
          </div>
          
          <Button 
            variant="destructive" 
            onClick={() => onDelete(record.id)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t.delete}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const PreviousRecordings: React.FC = () => {
  const { language } = useTheme();
  const { user } = useAuth();
  const t = translations[language];
  
  const [records, setRecords] = useState<TasjeelRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<TasjeelRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  
  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Load recordings on component mount
  useEffect(() => {
    if (user) {
      loadRecordings();
    }
  }, [user]);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const records = await getTasjeelRecords();
      // Now we only filter for records with summaries, not requiring both summary AND audio
      const recordsWithSummary = records.filter(record => record.summary);
      setRecords(recordsWithSummary);
    } catch (error) {
      console.error("Error loading recordings:", error);
      toast(error.message || "Error loading recordings");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = (record: TasjeelRecord) => {
    if (!audioRef.current) return;

    // Use summary_audio_path only (prefer this path)
    const audioSource = record.summary_audio_path;
    if (!audioSource) return; // Don't attempt playback if no audio available

    if (playingId === record.id) {
      // Same audio, toggle play/pause
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      // Different audio, switch to it
      audioRef.current.src = audioSource;
      audioRef.current.play();
      setPlayingId(record.id);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTasjeelRecord(id);
      setRecords(prevRecords => prevRecords.filter(record => record.id !== id));
      setDialogOpen(false);
      toast(t.deleteSuccess);
    } catch (error) {
      console.error("Error deleting recording:", error);
      toast(t.deleteError);
    }
  };

  const handleOpenDetails = (record: TasjeelRecord) => {
    setSelectedRecord(record);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <RefreshCw className="animate-spin h-6 w-6 mr-2" />
        <span>{t.loading}</span>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t.noRecordings}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        className="hidden"
      />
      
      <div className="grid grid-cols-1 gap-4">
        {records.map((record) => (
          <Card
            key={record.id}
            className="overflow-hidden hover:shadow-md transition-shadow"
            onClick={() => handleOpenDetails(record)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">
                    {record.title || format(new Date(record.created_at), "yyyy-MM-dd HH:mm")}
                  </h3>
                  <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(record.created_at), "yyyy-MM-dd HH:mm")}
                    </span>
                  </div>
                </div>
                
                {/* Quick actions - stop propagation to avoid opening the dialog */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {record.summary_audio_path && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPause(record);
                      }}
                    >
                      {playingId === record.id ? (
                        <PauseCircle className="h-5 w-5" />
                      ) : (
                        <PlayCircle className="h-5 w-5" />
                      )}
                    </Button>
                  )}
                  
                  {record.summary_audio_path && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        const link = document.createElement("a");
                        link.href = record.summary_audio_path;
                        link.download = `summary-${record.id.slice(0, 8)}.mp3`;
                        link.click();
                      }}
                    >
                      <Download className="h-5 w-5" />
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t.confirmDelete)) {
                        handleDelete(record.id);
                      }
                    }}
                  >
                    <Trash2 className="h-5 w-5 text-destructive" />
                  </Button>
                </div>
              </div>
              
              {/* Preview of summary */}
              {record.summary && (
                <div className="mt-2 text-sm line-clamp-2 text-muted-foreground">
                  {record.summary}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Recording details dialog */}
      <RecordingDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        record={selectedRecord}
        onDelete={handleDelete}
        t={t}
        language={language}
      />
    </div>
  );
};

export default PreviousRecordings;
