
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import RecordingDialog from "./RecordingDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function VoiceSummaryPage() {
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { language } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    async function fetchRecordings() {
      try {
        const { data, error } = await supabase
          .from('voice_recordings')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (error) {
          console.error('Error fetching recordings:', error);
          return;
        }
        
        setRecordings(data || []);
      } catch (err) {
        console.error('Error in fetchRecordings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchRecordings();
  }, [user]);

  const handleRecordingCreated = (newRecording) => {
    setRecordings([newRecording, ...recordings]);
    setShowRecordingDialog(false);
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">
            {language === 'ar' ? 'التسجيلات الأخيرة' : 'Recent Recordings'}
          </h2>
          <Button 
            onClick={() => setShowRecordingDialog(true)} 
            className="flex items-center gap-1"
          >
            <Plus size={18} />
            <span>{language === 'ar' ? 'تسجيل جديد' : 'New Recording'}</span>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : recordings.length > 0 ? (
          <VoiceSummaryArchive recordings={recordings} />
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
