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
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Volume2,
  Rewind,
  StopCircle,
  AlertCircle
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
    autoDeleteNotice: "⚠️ All recordings are automatically deleted after 10 days. Download important recordings to keep them permanently.",
    refresh: "Refresh"
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
    autoDeleteNotice: "⚠️ يتم حذف جميع التسجيلات تلقائياً بعد 10 أيام. قم بتنزيل التسجيلات المهمة للاحتفاظ بها بشكل دائم.",
    refresh: "تحديث"
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
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
          toast("Audio file may no longer exist");
        });
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const handleRewind = () => {
    if (audioRef.current) {
      // Rewind 10 seconds
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
      if (!audioPlaying) {
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
          toast("Audio file may no longer exist");
        });
        setAudioPlaying(true);
      }
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
  };

  const handleExportToPDF = async () => {
    if (!record) return;
    
    try {
      // Generate PDF with focus on the summary
      const pdfBlob = await generatePDF({
        title: record.title || "Tasjeel Recording",
        content: { text: record.summary || "No summary available" }, // Fix here: Changed string to object with text property
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
          
          {/* Audio player for summary audio with enhanced controls */}
          {record.summary_audio_path && (
            <div className="flex flex-col items-center justify-center py-4">
              <audio 
                ref={audioRef} 
                src={record.summary_audio_path} 
                onPlay={() => setAudioPlaying(true)}
                onPause={() => setAudioPlaying(false)}
                onEnded={() => setAudioPlaying(false)}
                onError={() => toast("Audio file may no longer exist")}
                className="hidden"
              />
              
              {/* Audio controls row */}
              <div className="flex gap-3 justify-center mb-2">
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-12 w-12 rounded-full" 
                  onClick={handleRewind}
                  title={t.rewind || "Rewind"}
                >
                  <Rewind className="h-6 w-6" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-12 w-12 rounded-full" 
                  onClick={handlePlayPause}
                  title={audioPlaying ? t.pause : t.play}
                >
                  {audioPlaying ? (
                    <PauseCircle className="h-6 w-6" />
                  ) : (
                    <PlayCircle className="h-6 w-6" />
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  size="icon"
                  className="h-12 w-12 rounded-full" 
                  onClick={handleStop}
                  title={t.stop || "Stop"}
                >
                  <StopCircle className="h-6 w-6" />
                </Button>
              </div>
              
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

  // Real-time subscription for database changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasjeel-previous-recordings-changes')
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tasjeel_records',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Recording deleted from database:', payload);
          // Remove the deleted recording from the UI
          setRecords(prev => prev.filter(rec => rec.id !== payload.old.id));
          // Close dialog if the deleted record was open
          if (selectedRecord?.id === payload.old.id) {
            setDialogOpen(false);
            setSelectedRecord(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasjeel_records',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Recording updated:', payload);
          // Update the recording in the UI
          setRecords(prev => prev.map(rec => 
            rec.id === payload.new.id ? { ...rec, ...payload.new } : rec
          ));
          // Update selected record if it's the one being viewed
          if (selectedRecord?.id === payload.new.id) {
            setSelectedRecord({ ...selectedRecord, ...payload.new });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedRecord]);

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
        audioRef.current.play().catch((error) => {
          console.error("Error playing audio:", error);
          toast("Audio file may no longer exist");
        });
      } else {
        audioRef.current.pause();
        setPlayingId(null);
      }
    } else {
      // Different audio, switch to it
      audioRef.current.src = audioSource;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
        toast("Audio file may no longer exist");
      });
      setPlayingId(record.id);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      console.log(`Attempting to delete recording: ${id}`);
      
      const { error } = await supabase
        .from("tasjeel_records")
        .delete()
        .eq("id", id)
        .eq("user_id", user?.id);

      if (error) {
        console.error("Delete error:", error);
        throw error;
      }
      
      console.log(`Successfully deleted recording: ${id}`);
      // The real-time subscription will handle UI updates
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

  return (
    <div className="space-y-4">
      {/* Auto-deletion warning notice */}
      <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          {t.autoDeleteNotice}
        </AlertDescription>
      </Alert>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadRecordings}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </div>

      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef}
        onEnded={() => setPlayingId(null)}
        onError={() => toast("Audio file may no longer exist")}
        className="hidden"
      />
      
      {records.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t.noRecordings}
        </div>
      ) : (
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
      )}
      
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
