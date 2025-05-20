
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, RefreshCw } from "lucide-react";
import RecordingTool from "./RecordingTool";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import VoiceSummaryArchive from "../voice-summary/VoiceSummaryArchive";

export default function RecordingToolPage() {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch recordings
  const fetchRecordings = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      console.log("[RecordingToolPage] Fetching recordings");
      
      const { data, error } = await supabase
        .from('voice_summaries')
        .select('*')
        .order('created_at', { ascending: false });
          
      if (error) {
        console.error('Error fetching recordings:', error);
        if (!silent) {
          toast.error(language === 'ar' ? 'فشل في تحميل التسجيلات' : 'Failed to load recordings');
        }
        return;
      }
      
      setRecordings(data || []);
    } catch (err) {
      console.error('Error in fetchRecordings:', err);
      if (!silent) {
        toast.error(language === 'ar' ? 'حدث خطأ أثناء تحميل التسجيلات' : 'An error occurred while loading recordings');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
  
  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchRecordings();
    }
  }, [user]);
  
  const handleRecordingCreated = async (recordingId: string) => {
    // Refresh the list to include the new recording
    await fetchRecordings();
    setShowRecordingDialog(false);
    
    toast.success(
      language === 'ar' 
        ? 'تم إنشاء التسجيل بنجاح' 
        : 'Recording created successfully'
    );
  };
  
  const handleRecordingDeleted = (recordingId: string) => {
    setRecordings(recordings.filter(recording => recording.id !== recordingId));
    
    // Close the detail dialog if the deleted recording was selected
    if (selectedRecordingId === recordingId) {
      setSelectedRecordingId(null);
    }
    
    toast.success(
      language === 'ar' 
        ? 'تم حذف التسجيل بنجاح' 
        : 'Recording deleted successfully'
    );
  };
  
  const handleManualRefresh = () => {
    fetchRecordings();
    toast.success(language === 'ar' ? 'جارِ تحديث القائمة...' : 'Refreshing list...');
  };

  const handleRecordingSelected = (recordingId: string) => {
    navigate(`/voice-summary/${recordingId}`);
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
            onRecordingSelected={handleRecordingSelected}
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
        <RecordingTool 
          isOpen={showRecordingDialog} 
          onClose={() => setShowRecordingDialog(false)} 
          onRecordingCreated={handleRecordingCreated}
        />
      </div>
    </div>
  );
};
