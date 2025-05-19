
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Mic, Square, Loader2 } from "lucide-react";
import { useVoiceSummaryController } from "@/hooks/useVoiceSummaryController";
import { useNavigate } from "react-router-dom";

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
    resetRecording 
  } = useVoiceSummaryController();
  
  // When recording completes successfully, notify parent and close dialog
  useEffect(() => {
    if (state.recordingState === "completed" && state.recordingId) {
      onRecordingCreated(state.recordingId);
      resetRecording();
    }
  }, [state.recordingState, state.recordingId, onRecordingCreated, resetRecording]);
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      resetRecording();
    }
  }, [isOpen, resetRecording]);
  
  // Handle dialog close
  const handleDialogClose = () => {
    if (state.recordingState === "recording") {
      cancelRecording();
    }
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
        if (state.processingStep === "transcribing") {
          return language === 'ar' ? 'جارِ التعرف على الصوت...' : 'Transcribing audio...';
        } else if (state.processingStep === "summarizing") {
          return language === 'ar' ? 'جارِ إنشاء الملخص...' : 'Generating summary...';
        }
        return language === 'ar' ? 'جارِ المعالجة...' : 'Processing...';
      case "error":
        return state.errorMessage || (language === 'ar' ? 'حدث خطأ' : 'An error occurred');
      default:
        return language === 'ar' ? 'جاهز للتسجيل' : 'Ready to record';
    }
  };
  
  // Check if we are in any kind of processing state
  const isProcessing = state.recordingState === "processing";
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
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
          {!isProcessing && (
            <Button variant="outline" onClick={handleDialogClose}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
