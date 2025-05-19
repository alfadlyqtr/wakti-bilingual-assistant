import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import RecordingDialog from "./RecordingDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw, AlertCircle, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getRecordingStatus } from "@/lib/utils";
import { deleteStuckRecordings, getAllRecordings, markRecordingsAsReady, regenerateSummary } from "@/services/voiceSummaryService";

export default function VoiceSummaryPage() {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [inProgressRecordings, setInProgressRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stuckRecordings, setStuckRecordings] = useState<any[]>([]);
  const [recoverableRecordings, setRecoverableRecordings] = useState<any[]>([]);
  const [isRecovering, setIsRecovering] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch recordings - separating ready, in-progress, stuck, and recoverable recordings
  const fetchRecordings = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      console.log("[VoiceSummaryPage] Fetching recordings");
      
      const { ready, processing, stuck, recoverable, error } = await getAllRecordings(true);
          
      if (error) {
        console.error('Error fetching recordings:', error);
        if (!silent) {
          toast({
            title: language === 'ar' ? 'فشل في تحميل التسجيلات' : 'Failed to load recordings',
            variant: "destructive"
          });
        }
        return;
      }
      
      console.log(`[VoiceSummaryPage] Ready: ${ready.length}, Processing: ${processing.length}, Stuck: ${stuck.length}, Recoverable: ${recoverable.length}`);
      
      setRecordings(ready);
      setInProgressRecordings(processing);
      setStuckRecordings(stuck);
      setRecoverableRecordings(recoverable);
    } catch (err) {
      console.error('Error in fetchRecordings:', err);
      if (!silent) {
        toast({
          title: language === 'ar' ? 'حدث خطأ أثناء تحميل التسجيلات' : 'An error occurred while loading recordings',
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Helper function to clean up stuck recordings
  const cleanupStuckRecordings = async () => {
    if (stuckRecordings.length === 0) return;
    
    try {
      setIsRefreshing(true);
      
      // Get IDs of stuck recordings
      const stuckIds = stuckRecordings.map(recording => recording.id);
      
      // Delete stuck recordings
      const { success, error } = await deleteStuckRecordings(stuckIds);
        
      if (!success) {
        console.error('Error deleting stuck recordings:', error);
        toast({
          title: language === 'ar' ? 'فشل في حذف التسجيلات العالقة' : 'Failed to delete stuck recordings',
          variant: "destructive"
        });
        return;
      }
      
      // Refresh the recordings
      await fetchRecordings(true);
      
      toast({
        title: language === 'ar' 
          ? `تم حذف ${stuckIds.length} تسجيلات عالقة` 
          : `Removed ${stuckIds.length} stuck recordings`,
        variant: "default"
      });
    } catch (err) {
      console.error('Error in cleanupStuckRecordings:', err);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Helper function to recover stalled recordings that have transcripts but aren't marked ready
  const recoverStuckRecordings = async () => {
    if (recoverableRecordings.length === 0) return;
    
    try {
      setIsRecovering(true);
      
      // Get IDs of recoverable recordings
      const recoverableIds = recoverableRecordings.map(recording => recording.id);
      
      // Mark recordings as ready
      const { success, count, error } = await markRecordingsAsReady(recoverableIds);
        
      if (!success) {
        console.error('Error recovering recordings:', error);
        toast({
          title: language === 'ar' ? 'فشل في استعادة التسجيلات' : 'Failed to recover recordings',
          variant: "destructive"
        });
        return;
      }
      
      // Refresh the recordings
      await fetchRecordings(true);
      
      toast({
        title: language === 'ar' 
          ? `تم استعادة ${count} تسجيلات` 
          : `Recovered ${count} recordings`,
        variant: "default"
      });
    } catch (err) {
      console.error('Error in recoverStuckRecordings:', err);
    } finally {
      setIsRecovering(false);
    }
  };
  
  // Helper function to regenerate summaries for recordings with transcripts but failed summaries
  const handleRegenerateSummaries = async () => {
    if (recoverableRecordings.length === 0) return;
    
    try {
      setIsRegenerating(true);
      let successCount = 0;
      
      // Process each recoverable recording
      for (const recording of recoverableRecordings) {
        // Attempt to regenerate the summary
        const { success, error } = await regenerateSummary(recording.id);
        
        if (success) {
          successCount++;
        } else {
          console.error(`Failed to regenerate summary for recording ${recording.id}:`, error);
        }
      }
      
      // Refresh the recordings
      await fetchRecordings(true);
      
      if (successCount > 0) {
        toast({
          title: language === 'ar' 
            ? `تم إعادة إنشاء ${successCount} ملخص(ات)` 
            : `Regenerated ${successCount} summary/summaries`,
          variant: "default"
        });
      } else {
        toast({
          title: language === 'ar'
            ? 'فشل في إعادة إنشاء الملخصات'
            : 'Failed to regenerate summaries',
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Error in handleRegenerateSummaries:', err);
      toast({
        title: language === 'ar'
          ? 'حدث خطأ أثناء إعادة إنشاء الملخصات'
          : 'Error regenerating summaries',
        variant: "destructive"
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Poll for updates to recording statuses
  useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    fetchRecordings();
    
    // Set up polling for recordings in progress
    const intervalId = setInterval(() => {
      if (inProgressRecordings.length > 0) {
        fetchRecordings(true); // Silent refresh
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [user, inProgressRecordings.length]);
  
  const handleRecordingCreated = async (recordingId: string) => {
    // Refresh the list to include the new recording
    await fetchRecordings();
    setShowRecordingDialog(false);
  };
  
  const handleRecordingDeleted = (recordingId: string) => {
    setRecordings(recordings.filter(recording => recording.id !== recordingId));
    setInProgressRecordings(inProgressRecordings.filter(recording => recording.id !== recordingId));
    setStuckRecordings(stuckRecordings.filter(recording => recording.id !== recordingId));
    setRecoverableRecordings(recoverableRecordings.filter(recording => recording.id !== recordingId));
  };
  
  const handleManualRefresh = () => {
    fetchRecordings();
    toast({
      title: language === 'ar' ? 'جارِ تحديث القائمة...' : 'Refreshing list...',
      variant: "default"
    });
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {language === 'ar' ? 'التسجيلات الأخيرة' : 'Recent Recordings'}
          </h2>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isLoading || isRefreshing}
              title={language === 'ar' ? 'تحديث' : 'Refresh'}
              className="h-9 w-9"
            >
              <RefreshCw size={18} className={isRefreshing ? "animate-spin" : ""} />
            </Button>
            <Button 
              onClick={() => setShowRecordingDialog(true)} 
              className="flex items-center gap-1"
            >
              <Plus size={18} />
              <span>{language === 'ar' ? 'تسجيل جديد' : 'New Recording'}</span>
            </Button>
          </div>
        </div>

        {/* Show recoverable recordings with recovery option */}
        {recoverableRecordings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-amber-500 flex items-center gap-1 mb-2">
              <Wrench className="h-4 w-4" />
              {language === 'ar' ? 'تسجيلات قابلة للاستعادة' : 'Recoverable Recordings'}
            </h3>
            <div className="border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900/30 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">
                    {language === 'ar' 
                      ? `${recoverableRecordings.length} تسجيل(ات) يمكن استعادتها`
                      : `${recoverableRecordings.length} recording(s) can be recovered`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={recoverStuckRecordings}
                    disabled={isRecovering || isRegenerating}
                    className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-800/30 border-amber-300 dark:border-amber-700"
                  >
                    {isRecovering ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        {language === 'ar' ? 'جارٍ الاستعادة...' : 'Recovering...'}
                      </>
                    ) : (
                      language === 'ar' ? 'استعادة التسجيلات' : 'Mark as Ready'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateSummaries}
                    disabled={isRecovering || isRegenerating}
                    className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-800/30 border-amber-300 dark:border-amber-700"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        {language === 'ar' ? 'جارٍ إعادة الإنشاء...' : 'Regenerating...'}
                      </>
                    ) : (
                      language === 'ar' ? 'إعادة إنشاء الملخصات' : 'Regenerate Summaries'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show stuck recordings with warning */}
        {stuckRecordings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
              <AlertCircle className="h-4 w-4" />
              {language === 'ar' ? 'تسجيلات عالقة' : 'Stuck Recordings'}
            </h3>
            <div className="border border-destructive/30 bg-destructive/10 rounded-md p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span className="text-sm">
                    {language === 'ar' 
                      ? `${stuckRecordings.length} تسجيل(ات) عالقة في المعالجة`
                      : `${stuckRecordings.length} recording(s) stuck in processing`}
                  </span>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={cleanupStuckRecordings}
                  disabled={isRefreshing}
                >
                  {language === 'ar' ? 'حذف التسجيلات العالقة' : 'Remove Stuck Recordings'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Show processing recordings with progress indicator */}
        {inProgressRecordings.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {language === 'ar' ? 'قيد المعالجة' : 'Processing'}
            </h3>
            <div className="border border-border/30 bg-muted/30 rounded-md p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">
                  {language === 'ar' 
                    ? `جارٍ معالجة ${inProgressRecordings.length} تسجيل(ات)...`
                    : `Processing ${inProgressRecordings.length} recording(s)...`}
                </span>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length > 0 ? (
          <VoiceSummaryArchive 
            recordings={recordings}
            onRecordingDeleted={handleRecordingDeleted}
            isRefreshing={isRefreshing}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <div className="text-muted-foreground mb-2">
              {language === 'ar' ? 'لا توجد تسجيلات بعد' : 'No recordings yet'}
            </div>
            <Button 
              variant="outline"
              onClick={() => setShowRecordingDialog(true)}
            >
              {language === 'ar' ? 'إنشاء أول تسجيل' : 'Create your first recording'}
            </Button>
          </div>
        )}
        
        {/* Recording Dialog */}
        <RecordingDialog 
          isOpen={showRecordingDialog} 
          onClose={() => setShowRecordingDialog(false)} 
          onRecordingCreated={handleRecordingCreated}
        />
      </div>
    </div>
  );
}
