
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Mic, Square, Loader2 } from "lucide-react";
import useVoiceSummaryController from "@/hooks/useVoiceSummaryController";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated: (recordingId: string) => void;
}

export default function RecordingDialog({ 
  isOpen, 
  onClose, 
  onRecordingCreated 
}: RecordingDialogProps) {
  const { language } = useTheme();
  const navigate = useNavigate();
  
  const { 
    state, 
    startRecording, 
    stopRecording, 
    cancelRecording, 
    resetRecording,
    waitForCompletion
  } = useVoiceSummaryController();
  
  const [isClosing, setIsClosing] = useState(false);
  
  // When recording completes successfully and is fully ready, notify parent and close dialog
  useEffect(() => {
    const handleRecordingCompleted = async () => {
      if (state.isFullyReady && state.recordingId) {
        console.log("[RecordingDialog] Recording is fully ready:", state.recordingId);
        
        // Notify parent about the completed recording
        onRecordingCreated(state.recordingId);
        
        // Reset internal state
        resetRecording();
        
        // Allow the dialog to close
        setIsClosing(false);
      }
    };
    
    handleRecordingCompleted();
  }, [state.isFullyReady, state.recordingId, onRecordingCreated, resetRecording]);
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      resetRecording();
      setIsClosing(false);
    }
  }, [isOpen, resetRecording]);
  
  // Handle dialog close
  const handleDialogClose = () => {
    if (state.recordingState === "recording") {
      cancelRecording();
      onClose();
      return;
    }
    
    // If we're processing, don't close immediately
    if (state.recordingState === "processing") {
      console.log("[RecordingDialog] Waiting for processing to complete before closing");
      setIsClosing(true);
      return;
    }
    
    // Otherwise reset and close
    resetRecording();
    onClose();
  };
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  // Get the current status text
  const getStatusText = () => {
    switch (state.recordingState) {
      case "recording":
        return language === 'ar' ? 'جارِ التسجيل...' : 'Recording...';
      case "processing":
        switch (state.processingStep) {
          case "uploading":
            return language === 'ar' ? 'جارِ تحميل الملف...' : 'Uploading audio...';
          case "transcribing":
            return language === 'ar' ? 'جارِ التعرف على الصوت...' : 'Transcribing audio...';
          case "summarizing":
            return language === 'ar' ? 'جارِ إنشاء الملخص...' : 'Generating summary...';
          case "generating_tts":
            return language === 'ar' ? 'جارِ إنشاء الصوت...' : 'Generating audio...';
          case "finalizing":
            return language === 'ar' ? 'جارٍ الإنهاء...' : 'Finalizing...';
          default:
            return language === 'ar' ? 'جارِ المعالجة...' : 'Processing...';
        }
      case "error":
        return state.errorMessage || (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
      default:
        return language === 'ar' ? 'جاهز للتسجيل' : 'Ready to record';
    }
  };
  
  // Check if we are in any kind of processing state
  const isProcessing = state.recordingState === "processing";
  
  return (
    <Dialog 
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isClosing) {
          handleDialogClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'ar' ? 'تسجيل صوتي جديد' : 'New Voice Recording'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6">
          {/* Status display */}
          <div className="text-center mb-6">
            <p className="text-lg font-medium">
              {getStatusText()}
            </p>
            
            {/* Show timer during recording */}
            {state.recordingState === "recording" && (
              <div className="text-xl font-mono mt-2">
                {formatTime(state.recordingTime)} / {formatTime(120)}
              </div>
            )}
            
            {/* Show progress during processing */}
            {state.recordingState === "processing" && (
              <div className="w-full mt-4">
                <Progress value={state.progress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {state.progress}%
                </p>
              </div>
            )}
            
            {/* Show error message */}
            {state.recordingState === "error" && state.errorMessage && (
              <p className="text-sm text-destructive mt-2">
                {state.errorMessage}
              </p>
            )}
          </div>
          
          {/* Recording button */}
          <div className="flex items-center justify-center gap-4">
            {state.recordingState === "idle" && (
              <Button
                onClick={() => startRecording()}
                size="lg"
                className="h-16 w-16 rounded-full"
              >
                <Mic className="h-8 w-8" />
              </Button>
            )}
            
            {state.recordingState === "recording" && (
              <Button
                onClick={() => stopRecording()}
                variant="destructive"
                size="lg"
                className="h-16 w-16 rounded-full animate-pulse"
              >
                <Square className="h-8 w-8" />
              </Button>
            )}
            
            {isProcessing && (
              <div className="h-16 w-16 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            
            {state.recordingState === "error" && (
              <Button
                onClick={() => resetRecording()}
                variant="outline"
              >
                {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
              </Button>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4">
          {!isProcessing && state.recordingState !== "completed" && (
            <Button variant="outline" onClick={handleDialogClose}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          )}
          
          {isProcessing && (
            <Button variant="outline" disabled={isClosing}>
              {isClosing 
                ? (language === 'ar' ? 'جارٍ الإغلاق...' : 'Closing...') 
                : (language === 'ar' ? 'انتظر من فضلك...' : 'Please wait...')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
