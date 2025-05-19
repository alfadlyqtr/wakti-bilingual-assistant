
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import RecordingDialog from "./RecordingDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { getRecordingStatus } from "@/lib/utils";

export default function VoiceSummaryPage() {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [inProgressRecordings, setInProgressRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stuckRecordings, setStuckRecordings] = useState<any[]>([]);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Maximum processing time before considering a recording as stuck (in milliseconds)
  const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutes

  // Fetch recordings - separating ready, in-progress, and stuck recordings
  const fetchRecordings = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      console.log("[VoiceSummaryPage] Fetching recordings");
      
      const { data, error } = await supabase
        .from('voice_summaries')
        .select('*')
        .order('created_at', { ascending: false });
          
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
      
      // Validate each recording before setting state
      const validRecordings = Array.isArray(data) ? data.filter(rec => rec && rec.id) : [];
      console.log(`[VoiceSummaryPage] Fetched ${validRecordings.length} recordings`);
      
      // Get current time for stuck recording detection
      const now = new Date().getTime();
      
      // Split recordings into ready, in-progress and stuck
      const readyRecordings = validRecordings.filter(recording => {
        // Primarily use the is_ready flag 
        if (recording.is_ready === true) {
          return true;
        }
        
        // Fall back to checking status using utility function for backwards compatibility
        const status = getRecordingStatus(recording);
        return status === 'complete';
      });
      
      const processingAndStuckRecordings = validRecordings.filter(recording => {
        // If is_ready is explicitly false, it's in progress
        if (recording.is_ready === false) {
          return true;
        }
        
        // Check for any active processing flags
        if (
          recording.is_processing_transcript === true || 
          recording.is_processing_summary === true || 
          recording.is_processing_tts === true
        ) {
          return true;
        }
        
        // If is_ready is not defined, check status using utility function
        if (recording.is_ready === undefined || recording.is_ready === null) {
          const status = getRecordingStatus(recording);
          return status !== 'complete';
        }
        
        return false;
      });
      
      // Separate stuck recordings from regular processing ones
      const stuck: any[] = [];
      const processing: any[] = [];
      
      processingAndStuckRecordings.forEach(recording => {
        // Check if the recording has been processing for too long
        const createdAt = new Date(recording.created_at).getTime();
        const processingTime = now - createdAt;
        
        if (processingTime > MAX_PROCESSING_TIME) {
          stuck.push(recording);
        } else {
          processing.push(recording);
        }
      });
      
      console.log(`[VoiceSummaryPage] Ready: ${readyRecordings.length}, Processing: ${processing.length}, Stuck: ${stuck.length}`);
      
      setRecordings(readyRecordings);
      setInProgressRecordings(processing);
      setStuckRecordings(stuck);
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
      const { error } = await supabase
        .from('voice_summaries')
        .delete()
        .in('id', stuckIds);
        
      if (error) {
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
