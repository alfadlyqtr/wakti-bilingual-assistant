
import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2, X } from "lucide-react";
import { createRecording, uploadAudio, transcribeAudio } from "@/services/voiceSummaryService";
import { getBestSupportedMimeType, formatRecordingTime } from "@/utils/audioUtils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
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
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        console.error("[RecordingDialog] No active session found");
        toast(language === 'ar' ? 'يجب تسجيل الدخول لاستخدام هذه الميزة' : 'You need to be logged in to use this feature');
        return;
      }
      
      console.log("[RecordingDialog] Starting recording with auth:", { 
        userId: session.session.user.id,
        isExpired: new Date().getTime() / 1000 > (session.session.expires_at || 0)
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
          console.log(`[RecordingDialog] Received audio chunk: ${e.data.size} bytes`);
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
  
  // Process the recorded audio
  const processRecording = async () => {
    if (audioChunks.length === 0) {
      toast(language === 'ar' ? 'لا يوجد تسجيل صوتي' : 'No audio recording');
      return;
    }
    
    setIsProcessing(true);
    setUploadStatus("Creating recording entry...");
    
    try {
      // Check auth before proceeding
      const { data: authData } = await supabase.auth.getSession();
      console.log("[RecordingDialog] Auth status before processing:", { 
        hasSession: !!authData.session, 
        userId: authData.session?.user?.id || 'none',
        expired: authData.session ? 
          (new Date().getTime() / 1000 > (authData.session.expires_at || 0)) : 'n/a'
      });
      
      // Create recording entry in database
      console.log("[RecordingDialog] Creating recording entry...");
      const { recording, error: createError, userId } = await createRecording();
      
      if (createError || !recording) {
        console.error("[RecordingDialog] Error creating recording entry:", createError);
        toast(language === 'ar' ? 'فشل في إنشاء تسجيل' : 'Failed to create recording');
        setIsProcessing(false);
        return;
      }
      
      // Combine audio chunks into a single blob
      setUploadStatus("Preparing audio data...");
      console.log(`[RecordingDialog] Combining ${audioChunks.length} audio chunks...`);
      const mimeType = getBestSupportedMimeType();
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      console.log(`[RecordingDialog] Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      if (audioBlob.size === 0) {
        console.error("[RecordingDialog] Empty audio blob created");
        toast(language === 'ar' ? 'ملف التسجيل فارغ' : 'Recording file is empty');
        setIsProcessing(false);
        return;
      }
      
      // Upload audio to storage
      setUploadStatus("Uploading audio recording...");
      console.log(`[RecordingDialog] Uploading audio for recording ${recording.id}...`);
      const uploadResult = await uploadAudio(audioBlob, recording.id, userId);
      const { path, error: uploadError, publicUrl, detailedError } = uploadResult;
      
      if (uploadError || !path) {
        console.error("[RecordingDialog] Error uploading audio:", uploadError);
        
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
      
      console.log("[RecordingDialog] Audio upload successful. Path:", path);
      console.log("[RecordingDialog] Public URL:", publicUrl);
      
      // Transcribe audio
      setUploadStatus("Starting transcription...");
      console.log("[RecordingDialog] Starting transcription...");
      const { error: transcribeError } = await transcribeAudio(recording.id);
      
      if (transcribeError) {
        console.warn("[RecordingDialog] Transcription started with warning:", transcribeError);
        // Continue anyway - transcription happens asynchronously
      }
      
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
                    disabled={isProcessing}
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
