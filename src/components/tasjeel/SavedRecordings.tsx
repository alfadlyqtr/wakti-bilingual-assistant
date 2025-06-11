import React, { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, manuallyDeleteOldRecordings } from "@/integrations/supabase/client";
import { TasjeelRecord } from "./types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-helper";
import { FileText, Download, Trash, AlertCircle, RefreshCw, Zap } from "lucide-react";
import { generatePDF } from "@/utils/pdfUtils";
import CompactRecordingCard from "./CompactRecordingCard";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Translations
const translations = {
  en: {
    noRecordings: "No saved recordings found",
    loadingRecordings: "Loading saved recordings...",
    playOriginalAudio: "Play Original",
    playSummaryAudio: "Play Summary",
    pauseAudio: "Pause",
    rewindAudio: "Rewind",
    stopAudio: "Stop",
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
    errorPlayingAudio: "Error playing audio",
    recordingDate: "Date",
    duration: "Duration",
    transcription: "Transcription",
    summary: "Summary",
    audio: "Audio",
    actions: "Actions",
    seconds: "seconds",
    audioSourceNotFound: "Audio source not found",
    tryingToPlay: "Trying to play audio...",
    uploadRecording: "Upload Audio",
    uploading: "Uploading...",
    uploadSuccess: "Upload successful",
    uploadError: "Upload failed",
    editTitle: "Edit title",
    titleUpdated: "Title updated",
    errorUpdatingTitle: "Error updating title",
    autoDeleteNotice: "⚠️ All recordings are automatically deleted after 10 days. Download important recordings to keep them permanently.",
    refresh: "Refresh",
    autoDeleted: "Auto-deleted"
  },
  ar: {
    noRecordings: "لم يتم العثور على تسجيلات محفوظة",
    loadingRecordings: "جارٍ تحميل التسجيلات المحفوظة...",
    playOriginalAudio: "تشغيل الأصلي",
    playSummaryAudio: "تشغيل الملخص",
    pauseAudio: "إيقاف مؤقت",
    rewindAudio: "إرجاع",
    stopAudio: "إيقاف",
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
    errorPlayingAudio: "خطأ في تشغيل الصوت",
    recordingDate: "التاريخ",
    duration: "المدة",
    transcription: "النص",
    summary: "الملخص",
    audio: "الصوت",
    actions: "الإجراءات",
    seconds: "ثواني",
    audioSourceNotFound: "لم يتم العثور على مصدر الصوت",
    tryingToPlay: "محاولة تشغيل الصوت...",
    uploadRecording: "تحميل ملف صوتي",
    uploading: "جار التحميل...",
    uploadSuccess: "تم التحميل بنجاح",
    uploadError: "فشل التحميل",
    editTitle: "تعديل العنوان",
    titleUpdated: "تم تحديث العنوان",
    errorUpdatingTitle: "خطأ في تحديث العنوان",
    autoDeleteNotice: "⚠️ يتم حذف جميع التسجيلات تلقائياً بعد 10 أيام. قم بتنزيل التسجيلات المهمة للاحتفاظ بها بشكل دائم.",
    refresh: "تحديث",
    autoDeleted: "تم الحذف تلقائياً"
  }
};

const SavedRecordings: React.FC = () => {
  const { theme, language } = useTheme();
  const { user } = useAuth();
  const t = translations[language];

  const [recordings, setRecordings] = useState<TasjeelRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);

  // Load saved recordings
  useEffect(() => {
    if (user) {
      loadSavedRecordings();
    }
  }, [user]);

  // Real-time subscription for database changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasjeel-recordings-changes')
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
          setRecordings(prev => prev.filter(rec => rec.id !== payload.old.id));
          toast(t.recordingDeleted);
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
          setRecordings(prev => prev.map(rec => 
            rec.id === payload.new.id ? { ...rec, ...payload.new } : rec
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, t.recordingDeleted]);

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

  // Manual cleanup function
  const handleManualCleanup = async () => {
    if (!confirm(language === 'ar' 
      ? 'هل تريد حذف جميع التسجيلات الأقدم من 10 أيام؟' 
      : 'Delete all recordings older than 10 days?'
    )) {
      return;
    }

    setIsCleaningUp(true);
    try {
      console.log('Starting manual cleanup...');
      const result = await manuallyDeleteOldRecordings();
      
      if (result.success) {
        toast(`${result.message} (${result.deletedCount || 0} records)`);
        // Reload the recordings to reflect changes
        await loadSavedRecordings();
      } else {
        toast(result.message);
      }
    } catch (error) {
      console.error('Manual cleanup error:', error);
      toast(language === 'ar' ? 'خطأ في التنظيف' : 'Cleanup failed');
    } finally {
      setIsCleaningUp(false);
    }
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

  // Delete recording function - improved with better error handling
  const deleteRecording = async (id: string) => {
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
      // The real-time subscription will handle UI updates and show success message
    } catch (error) {
      console.error("Error deleting recording:", error);
      throw error; // Re-throw to let CompactRecordingCard handle the error message
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

  return (
    <div className="space-y-4">
      {/* Auto-deletion warning notice */}
      <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          {t.autoDeleteNotice}
        </AlertDescription>
      </Alert>

      {/* Action buttons */}
      <div className="flex justify-between items-center">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualCleanup}
          disabled={isCleaningUp}
          className="text-xs"
        >
          <Zap className={`h-4 w-4 mr-2 ${isCleaningUp ? 'animate-pulse' : ''}`} />
          {isCleaningUp 
            ? (language === 'ar' ? 'جاري التنظيف...' : 'Cleaning...') 
            : (language === 'ar' ? 'تنظيف القديم' : 'Clean Old')
          }
        </Button>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={loadSavedRecordings}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </div>

      {recordings.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64">
          <p className="text-muted-foreground mb-4">{t.noRecordings}</p>
        </div>
      ) : (
        recordings.map(recording => (
          <CompactRecordingCard
            key={recording.id}
            recording={recording}
            onDelete={deleteRecording}
            onExportToPDF={exportToPDF}
            onDownloadAudio={downloadAudio}
            translations={{
              ...t,
              autoDeleted: t.autoDeleted
            }}
          />
        ))
      )}
    </div>
  );
};

export default SavedRecordings;
