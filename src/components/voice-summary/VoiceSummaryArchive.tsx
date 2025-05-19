import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { formatDistanceToNow } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, FileText, CheckCircle, Clock, DownloadCloud, Trash2, FileText as FileIcon, Volume } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { isValidDate, getRecordingStatus } from "@/lib/utils";

interface VoiceSummaryArchiveProps {
  recordings: any[];
  onRecordingDeleted?: (recordingId: string) => void;
  isRefreshing?: boolean;
  onRecordingSelected?: (recordingId: string) => void;
}

export default function VoiceSummaryArchive({ 
  recordings, 
  onRecordingDeleted, 
  isRefreshing = false,
  onRecordingSelected
}: VoiceSummaryArchiveProps) {
  const navigate = useNavigate();
  const { language } = useTheme();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const locale = language === 'ar' ? arSA : enUS;

  // Verify recordings are fully ready before rendering
  const readyRecordings = recordings.filter(recording => {
    // First check the is_ready flag (new approach)
    if (recording.is_ready === true) {
      return true;
    }
    
    // Fall back to checking full fields for backwards compatibility
    const isComplete = Boolean(
      recording && 
      recording.id &&
      recording.title &&
      recording.audio_url
    );
    
    return isComplete;
  });

  const getStatusIcon = (recording: any) => {
    const status = getRecordingStatus(recording);
    
    switch (status) {
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'transcribing':
      case 'pending':
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusText = (recording: any) => {
    const status = getRecordingStatus(recording);
    
    switch (status) {
      case 'complete':
        return language === 'ar' ? 'مكتمل' : 'Completed';
      case 'processing':
        return language === 'ar' ? 'تم النسخ' : 'Transcribed';
      case 'transcribing':
        return language === 'ar' ? 'قيد النسخ' : 'Transcribing';
      case 'pending':
      default:
        return language === 'ar' ? 'قيد المعالجة' : 'Processing';
    }
  };

  const getStatusVariant = (recording: any): "default" | "secondary" | "outline" => {
    const status = getRecordingStatus(recording);
    
    switch (status) {
      case 'complete':
        return "default";
      case 'processing':
        return "secondary";
      case 'transcribing':
      case 'pending':
      default:
        return "outline";
    }
  };

  const calculateDaysRemaining = (expiresAt: string | null | undefined): number => {
    if (!expiresAt) return 0;
    
    try {
      const expiryDate = new Date(expiresAt);
      
      // Check if the date is valid
      if (isNaN(expiryDate.getTime())) {
        return 0;
      }
      
      const now = new Date();
      const diffTime = expiryDate.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.error("Error calculating days remaining:", error);
      return 0;
    }
  };

  // Helper function to safely format date
  const safeFormatDistanceToNow = (dateString: string | null | undefined) => {
    if (!dateString) return "";
    
    try {
      if (!isValidDate(dateString)) {
        return language === 'ar' ? 'تاريخ غير صالح' : 'Invalid date';
      }
      
      const date = new Date(dateString);
      return formatDistanceToNow(date, { 
        addSuffix: true, 
        locale 
      });
    } catch (error) {
      console.error("Error formatting date:", error, dateString);
      return language === 'ar' ? 'تاريخ غير صالح' : 'Invalid date';
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error(language === 'ar' ? 'فشل في تنزيل الملف' : 'Download failed');
    }
  };

  const handleExportPDF = async (e: React.MouseEvent, recording: any) => {
    e.stopPropagation();
    
    if (!recording.transcript) {
      toast.error(language === 'ar' ? 'لا يوجد نص للتصدير' : 'No transcript to export');
      return;
    }
    
    try {
      // Create a simple formatted text for PDF export
      const content = `
${recording.title || 'Untitled Recording'}
${recording.created_at ? new Date(recording.created_at).toLocaleDateString() : 'Unknown date'}

${language === 'ar' ? 'النص:' : 'Transcript:'}
${recording.transcript}

${recording.summary ? (language === 'ar' ? 'الملخص:' : 'Summary:') : ''}
${recording.summary || ''}
      `;
      
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recording.title || 'recording'}-export.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(language === 'ar' ? 'تم تصدير المحتوى بنجاح' : 'Content exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(language === 'ar' ? 'فشل في تصدير المحتوى' : 'Export failed');
    }
  };

  const handleDelete = async () => {
    if (!recordingToDelete) return;
    
    setIsDeleting(true);
    try {
      const recording = recordings.find(r => r.id === recordingToDelete);
      
      if (!recording) {
        throw new Error("Recording not found");
      }
      
      // Get user ID from the recording or current user
      const userId = recording.user_id || recording.host;
      
      if (!userId) {
        throw new Error("User ID not found in recording");
      }
      
      // Construct the storage paths to delete
      const recordingPath = `voice_recordings/${userId}/${recordingToDelete}/recording.mp3`;
      const summaryPath = `voice_recordings/${userId}/${recordingToDelete}/summary.mp3`;
      
      // Delete recording from database
      const { error } = await supabase
        .from('voice_summaries')
        .delete()
        .eq('id', recordingToDelete);

      if (error) {
        throw error;
      }

      // Delete recording files from storage
      const { error: recordingError } = await supabase.storage
        .from('voice_recordings')
        .remove([recordingPath]);
      
      // Try to delete summary audio if it exists 
      await supabase.storage
        .from('voice_recordings')
        .remove([summaryPath])
        .catch(() => {
          // Ignore error if summary file doesn't exist
          console.log('No summary file to delete or deletion failed');
        });
      
      if (recordingError) {
        console.error('Failed to delete recording file:', recordingError);
        // Continue even if file deletion fails as the database record is gone
      }

      toast.success(language === 'ar' ? 'تم حذف التسجيل بنجاح' : 'Recording deleted successfully');
      
      // Notify parent component to update list
      if (onRecordingDeleted) {
        onRecordingDeleted(recordingToDelete);
      }
      
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error(language === 'ar' ? 'فشل في حذف التسجيل' : 'Failed to delete recording');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRecordingToDelete(null);
    }
  };

  const openDeleteDialog = (e: React.MouseEvent, recordingId: string) => {
    e.stopPropagation();
    setRecordingToDelete(recordingId);
    setDeleteDialogOpen(true);
  };

  const handlePlayAudio = (e: React.MouseEvent, url: string | null | undefined, recordingId: string) => {
    e.stopPropagation();
    
    if (!url) {
      toast.error(language === 'ar' ? 'عنوان URL للتسجيل غير متوفر' : 'Recording URL not available');
      return;
    }
    
    // Stop any currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.remove();
      setAudioElement(null);
    }
    
    if (isPlaying === recordingId) {
      setIsPlaying(null);
      return;
    }
    
    const audio = new Audio(url);
    audio.onended = () => setIsPlaying(null);
    audio.onpause = () => setIsPlaying(null);
    audio.onerror = () => {
      toast.error(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      setIsPlaying(null);
    };
    
    audio.play()
      .then(() => {
        setIsPlaying(recordingId);
        setAudioElement(audio);
      })
      .catch(error => {
        console.error('Error playing audio:', error);
        toast.error(language === 'ar' ? 'فشل في تشغيل التسجيل' : 'Failed to play recording');
      });
  };

  const handleRecordingClick = (recordingId: string) => {
    if (onRecordingSelected) {
      onRecordingSelected(recordingId);
    }
  };

  // Safely check if recordings array is valid before rendering
  if (!Array.isArray(recordings)) {
    console.error("Expected recordings to be an array but got:", recordings);
    return (
      <div className="text-center py-10">
        <p className="text-lg text-muted-foreground mb-2">
          {language === 'ar' ? 'خطأ في تحميل التسجيلات' : 'Error loading recordings'}
        </p>
      </div>
    );
  }

  // Render the list of recordings with proper loading states
  return (
    <>
      <div className="space-y-3">
        {isRefreshing && (
          <div className="border border-border/30 bg-muted/30 rounded-md p-2 mb-2">
            <p className="text-xs text-muted-foreground text-center animate-pulse">
              {language === 'ar' ? 'جارِ تحديث التسجيلات...' : 'Refreshing recordings...'}
            </p>
          </div>
        )}
        
        {readyRecordings.map((recording) => {
          if (!recording) return null; // Skip if recording is null/undefined
          
          const daysRemaining = calculateDaysRemaining(recording.expires_at);
          const status = getRecordingStatus(recording);
          
          return (
            <Card 
              key={recording.id}
              className={`hover:border-primary/50 transition-colors cursor-pointer ${
                daysRemaining <= 2 ? 'border-amber-200' : ''} ${
                status !== 'complete' ? 'border-dashed' : ''}`}
              onClick={() => handleRecordingClick(recording.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Mic className="h-5 w-5 text-primary" />
                    </div>
                    <div className="max-w-[180px] sm:max-w-xs">
                      <h3 className="font-medium text-base line-clamp-1">
                        {recording.title || (language === 'ar' ? 'تسجيل بدون عنوان' : 'Untitled Recording')}
                        {status !== 'complete' && (
                          <span className="ml-2 inline-flex">
                            <Clock className="h-3 w-3 animate-pulse text-amber-500" />
                          </span>
                        )}
                      </h3>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-1">
                        {isValidDate(recording.created_at) ? (
                          <span>{safeFormatDistanceToNow(recording.created_at)}</span>
                        ) : (
                          <span>{language === 'ar' ? 'للتو' : 'Just now'}</span>
                        )}
                        
                        {daysRemaining > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-muted rounded-sm">
                            {language === 'ar' 
                              ? `${daysRemaining} أيام متبقية` 
                              : `${daysRemaining} days left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => openDeleteDialog(e, recording.id)}
                      title={language === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handleExportPDF(e, recording)}
                      title={language === 'ar' ? 'تصدير نص' : 'Export Text'}
                      disabled={!recording.transcript}
                    >
                      <FileIcon className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => handlePlayAudio(e, recording.audio_url, recording.id)}
                      title={isPlaying === recording.id 
                        ? (language === 'ar' ? 'إيقاف' : 'Pause') 
                        : (language === 'ar' ? 'تشغيل' : 'Play')}
                      disabled={!recording.audio_url}
                    >
                      {isPlaying === recording.id ? (
                        <Clock className="h-4 w-4 animate-pulse text-primary" />
                      ) : (
                        <Volume className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {recording.audio_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(recording.audio_url, `recording-${recording.id}.mp3`);
                        }}
                        title={language === 'ar' ? 'تنزيل' : 'Download'}
                      >
                        <DownloadCloud className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Badge 
                      variant={getStatusVariant(recording)}
                      className="ml-1 flex items-center gap-1 h-6"
                    >
                      {getStatusIcon(recording)}
                      <span>{getStatusText(recording)}</span>
                    </Badge>
                  </div>
                </div>
                
                {recording.transcript ? (
                  <div className="mt-2 border-t pt-2 border-border/50">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <FileText className="h-3 w-3" />
                      <span>{language === 'ar' ? 'النص' : 'Transcript'}</span>
                    </div>
                    <p className="text-sm line-clamp-2">{recording.transcript}</p>
                  </div>
                ) : status !== 'complete' && status !== 'pending' ? (
                  <div className="mt-2 border-t pt-2 border-border/50">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}

        {readyRecordings.length === 0 && (
          <div className="text-center py-10">
            <p className="text-lg text-muted-foreground mb-2">
              {language === 'ar' ? 'لا توجد تسجيلات' : 'No recordings found'}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === 'ar' 
                ? 'انقر على زر "تسجيل جديد" لإضافة تسجيل جديد' 
                : 'Click the "New Recording" button to add a new recording'}
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'هل أنت متأكد أنك تريد الحذف؟' : 'Are you sure you want to delete?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'سيتم حذف هذا التسجيل بشكل نهائي. لا يمكن التراجع عن هذا الإجراء.' 
                : 'This recording will be permanently deleted. This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting 
                ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') 
                : (language === 'ar' ? 'حذف' : 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
