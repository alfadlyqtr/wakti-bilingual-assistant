
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryArchive from "./VoiceSummaryArchive";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Info } from "lucide-react";
import RecordingDialog from "./RecordingDialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { checkStoragePermissions, listStorageBuckets } from "@/utils/debugUtils";

export default function VoiceSummaryPage() {
  const { language } = useTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Log environment state on component mount
  useEffect(() => {
    const checkEnvironment = async () => {
      console.log("[VoiceSummaryPage] Environment check");
      
      try {
        // Check auth state
        const { data: authData } = await supabase.auth.getSession();
        console.log("[VoiceSummaryPage] Auth state:", { 
          hasSession: !!authData.session,
          hasUser: !!authData.session?.user,
          userId: authData.session?.user?.id || 'none'
        });
        
        // Check storage buckets
        const bucketsInfo = await listStorageBuckets();
        console.log("[VoiceSummaryPage] Storage buckets info:", bucketsInfo);
        
        // Check voice_recordings bucket permissions
        const permissionsCheck = await checkStoragePermissions('voice_recordings');
        console.log("[VoiceSummaryPage] voice_recordings bucket permissions:", permissionsCheck);
        
        // If we found permission issues, show a toast
        if (!permissionsCheck.canUpload) {
          console.warn("[VoiceSummaryPage] Upload permission check failed:", 
            permissionsCheck.uploadError || "Unknown permission error");
          
          toast.warning(language === 'ar' 
            ? 'تم اكتشاف مشكلة في الإذن لتحميل الملفات' 
            : 'Upload permission issue detected', {
              description: permissionsCheck.uploadError || "Unknown permission error"
            });
        }
        
        // Fetch recordings
        fetchRecordings();
      } catch (error) {
        console.error("[VoiceSummaryPage] Environment check error:", error);
        setIsLoading(false);
      }
    };
    
    checkEnvironment();
  }, [language]);
  
  const fetchRecordings = async () => {
    try {
      setIsLoading(true);
      const { data: authData } = await supabase.auth.getSession();
      
      if (!authData.session) {
        console.log("[VoiceSummaryPage] No authenticated session, cannot fetch recordings");
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from('voice_summaries')
        .select('*')
        .eq('user_id', authData.session.user.id)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("[VoiceSummaryPage] Error fetching recordings:", error);
        toast.error(language === 'ar' ? 'فشل في جلب التسجيلات' : 'Failed to fetch recordings');
      } else {
        console.log("[VoiceSummaryPage] Fetched recordings:", data);
        setRecordings(data || []);
      }
    } catch (error) {
      console.error("[VoiceSummaryPage] Exception in fetchRecordings:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleRecordingCreated = (recordingId: string) => {
    console.log("[VoiceSummaryPage] New recording created:", recordingId);
    toast.success(language === 'ar' ? 'تم إنشاء تسجيل جديد' : 'New recording created');
    fetchRecordings();
  };
  
  const handleRecordingDeleted = (id: string) => {
    console.log("[VoiceSummaryPage] Recording deleted:", id);
    setRecordings(prev => prev.filter(recording => recording.id !== id));
  };
  
  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {language === 'ar' ? 'التسجيلات الصوتية' : 'Voice Summaries'}
          </h1>
          <p className="text-muted-foreground">
            {language === 'ar' 
              ? 'سجّل ملاحظات صوتية واحصل على ملخصات آلية' 
              : 'Record voice notes and get automatic summaries'}
          </p>
        </div>
        
        <Button 
          onClick={() => {
            if (!user) {
              toast.error(language === 'ar' 
                ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' 
                : 'You must be logged in to use this feature');
              return;
            }
            setIsDialogOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Mic className="h-4 w-4" />
          {language === 'ar' ? 'تسجيل جديد' : 'New Recording'}
        </Button>
      </div>
      
      {isDialogOpen && (
        <RecordingDialog 
          isOpen={isDialogOpen} 
          onClose={() => setIsDialogOpen(false)}
          onRecordingCreated={handleRecordingCreated}
        />
      )}
      
      <VoiceSummaryArchive 
        recordings={recordings} 
        onRecordingDeleted={handleRecordingDeleted} 
        isRefreshing={isLoading}
      />
      
      <div className="bg-muted/50 rounded-lg p-4 border border-muted flex gap-3">
        <div className="text-amber-500 mt-1">
          <Info className="h-5 w-5" />
        </div>
        <div className="text-sm">
          <p className="font-medium">
            {language === 'ar' ? 'حول التسجيلات الصوتية' : 'About Voice Summaries'}
          </p>
          <p className="text-muted-foreground mt-1">
            {language === 'ar'
              ? 'تستخدم التسجيلات الصوتية تقنية التعرف على الكلام لتحويل صوتك إلى نص، ثم تُحلل النص باستخدام الذكاء الاصطناعي لإنشاء ملخص مفيد.'
              : 'Voice summaries use speech recognition technology to convert your voice to text, then analyze the text using AI to create a useful summary.'}
          </p>
        </div>
      </div>
    </div>
  );
}
