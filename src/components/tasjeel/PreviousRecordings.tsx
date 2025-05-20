
import React, { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, getTasjeelRecords, deleteTasjeelRecord, TasjeelRecord } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/toast-helper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ListMusic,
  Volume2
} from "lucide-react";

// Translations for PreviousRecordings component
const translations = {
  en: {
    previousRecordings: "Previous Recordings",
    noRecordings: "No recordings found",
    recorded: "Recorded",
    duration: "Duration",
    download: "Download",
    delete: "Delete",
    playback: "Playback",
    play: "Play",
    pause: "Pause",
    transcript: "Transcript",
    summary: "Summary",
    audio: "Audio Summary",
    downloadOriginal: "Download Original",
    downloadSummaryAudio: "Download Audio Summary",
    exportToPDF: "Export to PDF",
    confirmDelete: "Are you sure you want to delete this recording?",
    recordingDetails: "Recording Details",
    noTranscription: "No transcription available",
    noSummary: "No summary available",
    noAudioSummary: "No audio summary available",
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
    download: "تحميل",
    delete: "حذف",
    playback: "تشغيل",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    transcript: "النص",
    summary: "الملخص",
    audio: "الملخص الصوتي",
    downloadOriginal: "تحميل الأصلي",
    downloadSummaryAudio: "تحميل الملخص الصوتي",
    exportToPDF: "تصدير إلى PDF",
    confirmDelete: "هل أنت متأكد أنك تريد حذف هذا التسجيل؟",
    recordingDetails: "تفاصيل التسجيل",
    noTranscription: "لا يوجد نص متاح",
    noSummary: "لا يوجد ملخص متاح",
    noAudioSummary: "لا يوجد ملخص صوتي متاح",
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
  const [activeTab, setActiveTab] = useState<string>("transcript");
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
      await generatePDF({
        title: record.title || "Tasjeel Recording",
        content: { 
          text: [
            { label: "Transcription", content: record.transcription || "No transcription available" },
            { label: "Summary", content: record.summary || "No summary available" }
          ]
        },
        metadata: {
          createdAt: record.created_at,
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          type: "Tasjeel Recording"
        },
        language: language as 'en' | 'ar'
      });
      
      toast(t.pdfExported);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast(error.message || "An error occurred while exporting to PDF");
    }
  };

  const handleDownloadOriginal = () => {
    if (!record) return;
    
    const link = document.createElement("a");
    link.href = record.original_recording_path;
    link.download = `original-recording-${record.id.slice(0, 8)}.webm`;
    link.click();
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
              <ListMusic className="w-4 h-4" />
              {t.duration}: {formatDuration(record.duration)} {t.seconds}
            </div>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="transcript">{t.transcript}</TabsTrigger>
              <TabsTrigger value="summary">{t.summary}</TabsTrigger>
              <TabsTrigger value="audio">{t.audio}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="transcript" className="max-h-[300px] overflow-y-auto">
              {record.transcription ? (
                <div className="text-sm whitespace-pre-wrap">
                  {record.transcription}
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-6">
                  {t.noTranscription}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="summary" className="max-h-[300px] overflow-y-auto">
              {record.summary ? (
                <div className="text-sm whitespace-pre-wrap">
                  {record.summary}
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-6">
                  {t.noSummary}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="audio">
              {record.summary_audio_path ? (
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
              ) : (
                <div className="text-muted-foreground text-center py-6">
                  {t.noAudioSummary}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
        
        <Separator />
        
        <div className="p-4 flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleDownloadOriginal}
            >
              <Download className="mr-2 h-4 w-4" />
              {t.downloadOriginal}
            </Button>
            
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
      setRecords(records);
    } catch (error) {
      console.error("Error loading recordings:", error);
      toast(error.message || "Error loading recordings");
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = (record: TasjeelRecord) => {
    if (!audioRef.current) return;

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
      audioRef.current.src = record.original_recording_path;
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
                    {record.duration && (
                      <span className="flex items-center gap-1">
                        <ListMusic className="w-3 h-3" />
                        {formatDuration(record.duration)}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Quick actions - stop propagation to avoid opening the dialog */}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
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
                  
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement("a");
                      link.href = record.original_recording_path;
                      link.download = `recording-${record.id.slice(0, 8)}.webm`;
                      link.click();
                    }}
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  
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
              
              {/* Preview of transcription/summary */}
              {record.transcription && (
                <div className="mt-2 text-sm line-clamp-2 text-muted-foreground">
                  {record.transcription}
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
