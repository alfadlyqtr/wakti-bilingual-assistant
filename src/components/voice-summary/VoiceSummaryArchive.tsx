
import React, { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, FileText, MoreVertical, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getRecordingStatus } from "@/lib/utils";
import { isValidDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface VoiceSummaryArchiveProps {
  recordings: any[];
  onRecordingDeleted?: (id: string) => void;
  isRefreshing?: boolean;
  onRecordingSelected?: (id: string) => void;
}

export default function VoiceSummaryArchive({ 
  recordings,
  onRecordingDeleted,
  isRefreshing = false,
  onRecordingSelected
}: VoiceSummaryArchiveProps) {
  const { language, theme } = useTheme();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordingToDelete, setRecordingToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString || !isValidDate(dateString)) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  const handleDeleteClick = (id: string) => {
    setRecordingToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!recordingToDelete) return;
    
    try {
      setIsDeleting(true);
      
      // Get the recording to get user_id for path construction
      const { data: recording, error: fetchError } = await supabase
        .from('voice_summaries')
        .select('user_id')
        .eq('id', recordingToDelete)
        .single();
        
      if (fetchError) {
        console.error("Error fetching recording for deletion:", fetchError);
        toast.error(language === 'ar' ? 'فشل في جلب التسجيل' : 'Failed to fetch recording');
        return;
      }
        
      // Delete the record from the database
      const { error: deleteError } = await supabase
        .from('voice_summaries')
        .delete()
        .eq('id', recordingToDelete);
        
      if (deleteError) {
        console.error("Error deleting recording:", deleteError);
        toast.error(language === 'ar' ? 'فشل في حذف التسجيل' : 'Failed to delete recording');
        return;
      }
      
      // Delete the audio file from storage if user_id is available
      if (recording?.user_id) {
        const storagePath = `${recording.user_id}/${recordingToDelete}`;
        
        try {
          const { data: storageFiles } = await supabase.storage
            .from('voice_recordings')
            .list(storagePath);
            
          if (storageFiles && storageFiles.length > 0) {
            const filePaths = storageFiles.map(file => `${storagePath}/${file.name}`);
            
            const { error: storageError } = await supabase.storage
              .from('voice_recordings')
              .remove(filePaths);
              
            if (storageError) {
              console.error("Error deleting audio files:", storageError);
              // Don't fail the whole operation if file deletion fails
              // The database record is already deleted
            }
          }
        } catch (storageError) {
          console.error("Error handling storage deletion:", storageError);
          // Don't fail the whole operation if file deletion fails
        }
      }
      
      // Notify parent about deletion
      if (onRecordingDeleted) {
        onRecordingDeleted(recordingToDelete);
      }
      
      toast.success(language === 'ar' ? 'تم حذف التسجيل بنجاح' : 'Recording deleted successfully');
    } catch (error) {
      console.error("Error in handleDeleteConfirm:", error);
      toast.error(language === 'ar' ? 'حدث خطأ أثناء حذف التسجيل' : 'An error occurred while deleting the recording');
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRecordingToDelete(null);
    }
  };
  
  const handleRecordingClick = (id: string) => {
    if (onRecordingSelected) {
      onRecordingSelected(id);
    }
  };
  
  // Determine card styles based on recording status and theme
  const getCardStyles = (recording: any) => {
    const status = getRecordingStatus(recording);
    
    // Basic hover styles
    let hoverStyles = "hover:border-primary/50 cursor-pointer";
    
    // Status-specific styles
    switch (status) {
      case 'processing':
      case 'transcribing':
        return `border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/5 ${hoverStyles}`;
      case 'complete':
        return `border-border ${hoverStyles}`;
      default:
        return `border-border/50 ${hoverStyles}`;
    }
  };
  
  // Get the recording type badge
  const getRecordingTypeBadge = (type: string) => {
    // Translation map for recording types
    const typeTranslations: { [key: string]: string } = {
      note: language === 'ar' ? 'ملاحظة' : 'Note',
      summary: language === 'ar' ? 'ملخص' : 'Summary',
      lecture: language === 'ar' ? 'محاضرة' : 'Lecture',
      meeting: language === 'ar' ? 'اجتماع' : 'Meeting'
    };
    
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {typeTranslations[type] || type}
      </span>
    );
  };
  
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isRefreshing && recordings.length === 0 ? (
          // Show skeletons while refreshing empty list
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={`skeleton-${i}`} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <Skeleton className="h-5 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-8 w-full mt-2" />
              </CardContent>
            </Card>
          ))
        ) : (
          // Show actual recordings
          recordings.map((recording) => (
            <Card 
              key={recording.id} 
              className={`overflow-hidden transition-all ${getCardStyles(recording)}`}
              onClick={() => handleRecordingClick(recording.id)}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start" dir={language === 'ar' ? 'rtl' : 'ltr'}>
                  <div className="space-y-1">
                    <h3 className="font-medium text-base line-clamp-1" title={recording.title}>
                      {recording.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {recording.type && getRecordingTypeBadge(recording.type)}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(recording.created_at)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={language === 'ar' ? 'start' : 'end'}>
                      <DropdownMenuLabel>{language === 'ar' ? 'خيارات' : 'Options'}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(recording.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {language === 'ar' ? 'حذف' : 'Delete'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div 
                  className={`flex items-center gap-1 text-xs text-muted-foreground mt-2 ${language === 'ar' ? 'justify-end' : ''}`}
                  dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                  <FileText className="h-3 w-3" />
                  {recording.transcript ? (
                    <span className="line-clamp-1">{recording.transcript}</span>
                  ) : (
                    <span>{language === 'ar' ? 'جارٍ التحويل...' : 'Transcribing...'}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'هل أنت متأكد من حذف هذا التسجيل؟' : 'Are you sure you want to delete this recording?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar' 
                ? 'سيتم حذف هذا التسجيل نهائيًا وكذلك الملخص والنص المكتوب المرتبط به.' 
                : 'This recording will be permanently deleted, along with its summary and transcript.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting
                ? language === 'ar' ? 'جارٍ الحذف...' : 'Deleting...'
                : language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
