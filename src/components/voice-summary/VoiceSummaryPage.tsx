
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Poll for updates to recording statuses
  useEffect(() => {
    if (!user) return;
    
    // Initial fetch
    fetchRecordings();
    
    // Set up polling for recordings in progress
    const hasIncompleteRecordings = () => {
      return recordings.some(recording => {
        const status = getRecordingStatus(recording);
        return status === 'processing' || status === 'transcribing';
      });
    };
    
    // Check for updates more frequently if there are pending recordings
    let pollingInterval = hasIncompleteRecordings() ? 5000 : 20000;
    const intervalId = setInterval(() => {
      if (hasIncompleteRecordings()) {
        fetchRecordings(true); // Silent refresh
      }
    }, pollingInterval);
    
    return () => clearInterval(intervalId);
  }, [user, recordings]);
  
  const fetchRecordings = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
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
      console.log(`Fetched ${validRecordings.length} recordings`);
      
      setRecordings(validRecordings);
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

  const handleRecordingCreated = async (recordingId: string) => {
    // Instead of immediately adding the recording, refresh the list
    // This ensures we get the full DB record with all fields
    await fetchRecordings();
    setShowRecordingDialog(false);
  };
  
  const handleRecordingDeleted = (recordingId: string) => {
    setRecordings(recordings.filter(recording => recording.id !== recordingId));
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
