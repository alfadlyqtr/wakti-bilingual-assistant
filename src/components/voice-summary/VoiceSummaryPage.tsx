
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import RecordingDialog from "./RecordingDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw } from "lucide-react";
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
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch recordings - separating ready and in-progress recordings
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
      
      // Split recordings into ready and in-progress
      const readyRecordings = validRecordings.filter(recording => {
        // Check for the is_ready flag first
        if (recording.is_ready === true) {
          return true;
        }
        
        // Fall back to checking status using utility function for backwards compatibility
        const status = getRecordingStatus(recording);
        return status === 'complete';
      });
      
      const processingRecordings = validRecordings.filter(recording => {
        // If is_ready is explicitly false, it's in progress
        if (recording.is_ready === false) {
          return true;
        }
        
        // If is_ready is not defined, check status using utility function
        if (recording.is_ready === undefined || recording.is_ready === null) {
          const status = getRecordingStatus(recording);
          return status !== 'complete';
        }
        
        return false;
      });
      
      console.log(`[VoiceSummaryPage] Ready recordings: ${readyRecordings.length}, In progress: ${processingRecordings.length}`);
      
      setRecordings(readyRecordings);
      setInProgressRecordings(processingRecordings);
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
