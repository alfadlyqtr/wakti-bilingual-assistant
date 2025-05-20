import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import { createRecording, uploadAudio, transcribeAudio } from "@/services/voiceSummaryService";
import { 
  getBestSupportedMimeType, 
  formatRecordingTime, 
  ensureCorrectMimeType, 
  generateRecordingPath, 
  validateRecordingPath 
} from "@/utils/audioUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createVoiceRecordingsBucket } from "@/utils/debugUtils";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated?: (recordingId: string) => void;
}

export default function RecordingDialog({ 
  isOpen, 
  onClose,
  onRecordingCreated
}: RecordingDialogProps) {
  const { language } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordingComplete, setRecordingComplete] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bucketReady, setBucketReady] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize bucket check
  useEffect(() => {
    if (isOpen) {
      // Check and create bucket if needed
      const initBucket = async () => {
        console.log("[RecordingDialog] Initializing storage bucket...");
        const { success, error } = await createVoiceRecordingsBucket();
        console.log("[RecordingDialog] Bucket initialization result:", { success, error });
        setBucketReady(success);
        
        if (!success) {
          console.error("[RecordingDialog] Failed to initialize bucket:", error);
          toast.error(language === 'ar' 
            ? 'فشل في تهيئة التخزين. يرجى المحاولة مرة أخرى.' 
            : 'Failed to initialize storage. Please try again.');
        }
      };
      initBucket();
    }
  }, [isOpen, language]);
  
  // Clean up on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Reset state when dialog opens or closes
  useEffect(() => {
    if (!isOpen) {
      setIsRecording(false);
      setIsProcessing(false);
      setRecordingDuration(0);
      setAudioChunks([]);
      setRecordingComplete(false);
      setUploadStatus("");
      setUploadProgress(0);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current = null;
      }
    }
  }, [isOpen]);
  
  // Start recording
  const startRecording = async () => {
    try {
      // Check auth status before recording
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error("[RecordingDialog] No active session found");
        toast(language === 'ar' ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' : 'You need to be logged in to use this feature');
        return;
      }
      
      console.log("[RecordingDialog] Starting recording with auth:", { 
        userId: authData.session.user.id,
        isExpired: new Date().getTime() / 1000 > (authData.session.expires_at || 0)
      });
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      // Get the best supported MIME type
      const mimeType = getBestSupportedMimeType();
      console.log(`[RecordingDialog] Using MIME type: ${mimeType}`);
      
      // Create new recorder
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      
      // Clear existing audio chunks
      setAudioChunks([]);
      
      // Set up event handlers
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          console.log(`[RecordingDialog] Received audio chunk: ${e.data.size} bytes, type: ${e.data.type}`);
          setAudioChunks((prev) => [...prev, e.data]);
        }
      };
      
      recorder.onstop = () => {
        setIsRecording(false);
        setRecordingComplete(true);
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.onerror = (event) => {
        console.error("[RecordingDialog] MediaRecorder error:", event);
        toast(language === 'ar' ? 'خطأ في التسجيل' : 'Recording error');
      };
      
      // Start recording
      recorder.start(1000);
      setIsRecording(true);
      
      // Start timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("[RecordingDialog] Error starting recording:", error);
      toast(language === 'ar' ? 'فشل في بدء التسجيل' : 'Failed to start recording');
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };
  
  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setAudioChunks([]);
    setRecordingComplete(false);
    onClose();
  };
  
  // Process the recorded audio with progress simulation
  const processRecording = async () => {
    if (audioChunks.length === 0) {
      toast(language === 'ar' ? 'لا يوجد تسجيل صوتي' : 'No audio recording');
      return;
    }
    
    setIsProcessing(true);
    setUploadStatus(language === 'ar' ? 'إنشاء تسجيل...' : "Creating recording entry...");
    setUploadProgress(10);
    
    try {
      // 🚨 CRITICAL: Verify auth before proceeding
      const { data: authData } = await supabase.auth.getSession();
      console.log("[RecordingDialog] 🔍 Auth verification before processing:", { 
        hasSession: !!authData.session, 
        userId: authData.session?.user?.id || 'none',
        expired: authData.session ? 
          (new Date().getTime() / 1000 > (authData.session.expires_at || 0)) : 'n/a',
        expireTime: authData.session?.expires_at || 'none'
      });
      
      if (!authData.session || !authData.session.user) {
        console.error("[RecordingDialog] 🚨 AUTH FAILED: No valid session or user");
        toast.error(language === 'ar' ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' : 'You need to be logged in to use this feature');
        setIsProcessing(false);
        return;
      }
      
      // Create recording entry in database
      console.log("[RecordingDialog] Creating recording entry...");
      const { recording, error: createError, userId } = await createRecording();
      setUploadProgress(20);
      
      if (createError || !recording) {
        console.error("[RecordingDialog] Error creating recording entry:", createError);
        toast.error(language === 'ar' ? 'فشل في إنشاء تسجيل' : 'Failed to create recording');
        setIsProcessing(false);
        return;
      }
      
      // Combine audio chunks into a single blob
      setUploadStatus(language === 'ar' ? 'تحضير بيانات الصوت...' : "Preparing audio data...");
      setUploadProgress(30);
      console.log(`[RecordingDialog] Combining ${audioChunks.length} audio chunks...`);
      
      // Log each chunk's type before combining
      audioChunks.forEach((chunk, index) => {
        console.log(`[RecordingDialog] Chunk ${index} type: ${chunk.type}, size: ${chunk.size} bytes`);
      });
      
      const mimeType = getBestSupportedMimeType();
      
      // Create a new blob with explicit MIME type
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      // Detailed logging about the blob
      console.log(`[RecordingDialog] Audio blob created:`, {
        typeofBlob: typeof audioBlob,
        constructor: audioBlob.constructor.name,
        size: audioBlob.size,
        type: audioBlob.type,
        setMimeType: mimeType,
        isWebmMime: mimeType.includes('webm'),
        chunksLength: audioChunks.length,
        chunksTypes: audioChunks.map(chunk => chunk.type).filter((v, i, a) => a.indexOf(v) === i)
      });
      
      if (audioBlob.size === 0) {
        console.error("[RecordingDialog] Empty audio blob created");
        toast.error(language === 'ar' ? 'ملف التسجيل فارغ' : 'Recording file is empty');
        setIsProcessing(false);
        return;
      }
      
      // Ensure correct MIME type
      const fixedBlob = ensureCorrectMimeType(audioBlob, mimeType);
      
      // Upload audio to storage
      setUploadStatus(language === 'ar' ? 'جارٍ تحميل التسجيل الصوتي...' : "Uploading audio recording...");
      setUploadProgress(50);
      console.log(`[RecordingDialog] 🚨 CRITICAL - Upload preparation:`, {
        recordingId: recording.id,
        userId: userId,
        userIdType: typeof userId,
        userIdLength: userId?.length || 0,
        sessionUserId: authData.session.user.id,
        match: userId === authData.session.user.id ? "✅ MATCH" : "❌ MISMATCH"
      });
      
      // Generate the expected file path before uploading
      const expectedPath = generateRecordingPath(userId, recording.id);
      console.log(`[RecordingDialog] 📁 Expected file path: ${expectedPath}`);
      console.log(`[RecordingDialog] 📁 Full bucket path: voice_recordings/${expectedPath}`);
      
      // Validate the path before proceeding
      const pathValidation = validateRecordingPath(expectedPath);
      if (!pathValidation.valid) {
        console.error("[RecordingDialog] 🚨 PATH VALIDATION FAILED:", pathValidation.reason);
        toast.error(language === 'ar' 
          ? `خطأ في مسار الملف: ${pathValidation.reason}` 
          : `File path error: ${pathValidation.reason}`);
        setIsProcessing(false);
        return;
      }
      
      const uploadResult = await uploadAudio(fixedBlob, recording.id, userId);
      const { path, error: uploadError, publicUrl, detailedError } = uploadResult;
      setUploadProgress(70);
      
      if (uploadError || !path) {
        console.error("[RecordingDialog] 🚨 UPLOAD ERROR:", uploadError);
        
        // Show more detailed error message
        const errorMessage = detailedError || 
          (uploadError instanceof Error ? uploadError.message : 'Unknown upload error');
        
        console.error("[RecordingDialog] Detailed upload error:", errorMessage);
        
        toast.error(language === 'ar' 
          ? `فشل في تحميل التسجيل الصوتي: ${errorMessage}` 
          : `Failed to upload audio: ${errorMessage}`);
        setIsProcessing(false);
        return;
      }
      
      console.log("[RecordingDialog] ✅ Audio upload successful. Path:", path);
      console.log("[RecordingDialog] Public URL:", publicUrl);
      
      // Transcribe audio
      setUploadStatus(language === 'ar' ? 'بدء النسخ...' : "Starting transcription...");
      setUploadProgress(90);
      console.log("[RecordingDialog] Starting transcription...");
      const { error: transcribeError } = await transcribeAudio(recording.id);
      
      if (transcribeError) {
        console.warn("[RecordingDialog] Transcription started with warning:", transcribeError);
        // Continue anyway - transcription happens asynchronously
      }
      
      setUploadProgress(100);
      
      // Notify parent component of successful recording
      if (onRecordingCreated) {
        onRecordingCreated(recording.id);
      }
      
      toast.success(language === 'ar' ? 'تم إنشاء التسجيل بنجاح' : 'Recording created successfully');
      
      // Close the dialog
      onClose();
    } catch (error) {
      console.error("[RecordingDialog] Error processing recording:", error);
      toast.error(language === 'ar' 
        ? `حدث خطأ أثناء معالجة التسجيل: ${(error as Error).message}` 
        : `Error processing recording: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
      setUploadStatus("");
      setUploadProgress(0);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تسجيل صوتي جديد' : 'New Voice Recording'}
          </DialogTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={cancelRecording}
            disabled={isProcessing}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 space-y-8">
          {!bucketReady && (
            <div className="text-amber-500 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-md text-sm text-center">
              {language === 'ar' 
                ? 'جاري التحقق من سلامة التخزين...' 
                : 'Checking storage configuration...'}
            </div>
          )}
          
          {!recordingComplete ? (
            <>
              <div className="relative flex items-center justify-center">
                <div 
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                    isRecording 
                      ? 'bg-red-100 dark:bg-red-900/30 animate-pulse' 
                      : 'bg-primary-50 dark:bg-primary-900/10'
                  }`}
                >
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isProcessing || !bucketReady}
                    size="icon"
                    variant={isRecording ? "destructive" : "default"}
                    className="w-16 h-16 rounded-full"
                  >
                    {isRecording ? (
                      <MicOff className="h-8 w-8" />
                    ) : (
                      <Mic className="h-8 w-8" />
                    )}
                  </Button>
                </div>
                
                {isRecording && (
                  <div className="absolute -bottom-8 text-sm font-mono">
                    {formatRecordingTime(recordingDuration)}
                  </div>
                )}
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-medium">
                  {isRecording 
                    ? (language === 'ar' ? 'جارٍ التسجيل...' : 'Recording...') 
                    : (language === 'ar' ? 'اضغط للبدء' : 'Press to start')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isRecording 
                    ? (language === 'ar' ? 'اضغط مرة أخرى للتوقف' : 'Press again to stop') 
                    : (language === 'ar' ? 'سيتم تحويل الصوت إلى نص وملخص' : 'Audio will be converted to text & summary')}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="font-medium text-center">
                  {language === 'ar' ? 'التسجيل جاهز' : 'Recording Ready'}
                </h3>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {language === 'ar' 
                    ? `مدة: ${formatRecordingTime(recordingDuration)}` 
                    : `Duration: ${formatRecordingTime(recordingDuration)}`}
                </p>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setAudioChunks([]);
                    setRecordingComplete(false);
                  }}
                  disabled={isProcessing}
                >
                  {language === 'ar' ? 'إعادة التسجيل' : 'Re-record'}
                </Button>
                <Button 
                  onClick={processRecording}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {uploadStatus || (language === 'ar' ? 'جارٍ المعالجة...' : 'Processing...')}
                    </>
                  ) : (
                    language === 'ar' ? 'استخدام التسجيل' : 'Use Recording'
                  )}
                </Button>
              </div>
              
              {isProcessing && uploadProgress > 0 && (
                <div className="w-full">
                  <div className="h-2 bg-gray-200 rounded-full w-full mt-2">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
