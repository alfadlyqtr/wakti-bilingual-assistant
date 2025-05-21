
import React, { useState, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { TasjeelRecord } from "./types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-helper";
import { FileText, Download, Trash } from "lucide-react";
import { generatePDF } from "@/utils/pdfUtils";
import CompactRecordingCard from "./CompactRecordingCard";

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
    errorUpdatingTitle: "Error updating title"
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
    errorUpdatingTitle: "خطأ في تحديث العنوان"
  }
};

const SavedRecordings: React.FC = () => {
  const { theme, language } = useTheme();
  const { user } = useAuth();
  const t = translations[language];

  const [recordings, setRecordings] = useState<TasjeelRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);

  // Load saved recordings
  useEffect(() => {
    if (user) {
      loadSavedRecordings();
    }
  }, [user]);

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

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload file to storage
      const fileName = `upload-${Date.now()}-${file.name}`;
      const filePath = `${user?.id}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from("tasjeel_recordings")
        .upload(filePath, file, {
          contentType: file.type,
          cacheControl: "3600"
        });
        
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: publicUrlData } = supabase
        .storage
        .from("tasjeel_recordings")
        .getPublicUrl(filePath);
      
      const audioUrl = publicUrlData.publicUrl;
      
      // Create record in database
      await supabase
        .from("tasjeel_records")
        .insert({
          user_id: user?.id,
          title: file.name,
          original_recording_path: audioUrl,
          saved: true,
          duration: Math.round(file.size / 16000) // Rough estimate of duration based on file size
        });
      
      toast(t.uploadSuccess);
      
      // Reload recordings
      loadSavedRecordings();
      
    } catch (error) {
      console.error("Error uploading file:", error);
      toast(t.uploadError);
    } finally {
      setUploading(false);
      // Reset the input
      e.target.value = "";
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
      <div className="flex justify-end mb-4">
        <label className="cursor-pointer">
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileUpload}
            disabled={uploading}
          />
          <Button disabled={uploading}>
            {uploading ? t.uploading : t.uploadRecording}
          </Button>
        </label>
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
            translations={t}
          />
        ))
      )}
    </div>
  );
};

export default SavedRecordings;
