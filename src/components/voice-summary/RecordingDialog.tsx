
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/providers/ThemeProvider";
import { Mic, Square, Loader2 } from "lucide-react";
import useVoiceSummaryController from "@/hooks/useVoiceSummaryController";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { formatRecordingTime } from "@/utils/audioUtils";

interface RecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated: (recordingId: string) => void;
}

// Maximum recording duration in seconds (2 hours = 7200 seconds)
const MAX_RECORDING_DURATION = 7200;

export default function RecordingDialog({ 
  isOpen, 
  onClose, 
  onRecordingCreated 
}: RecordingDialogProps) {
  const { language } = useTheme();
  const navigate = useNavigate();
  
  // Recording type state
  const [recordingType, setRecordingType] = useState("note");
  
  const controller = useVoiceSummaryController();
  const { 
    startRecording, 
    stopRecording, 
    cancelRecording, 
    resetRecording,
    waitForCompletion,
    state 
  } = controller;
  
  const [isClosing, setIsClosing] = useState(false);
  
  // When recording completes successfully and is fully ready, notify parent and close dialog
  useEffect(() => {
    if (!state.isFullyReady || !state.recordingId) {
      return;
    }
    
    console.log("[RecordingDialog] Recording is fully ready:", state.recordingId);
    
    // Notify parent about the completed recording
    onRecordingCreated(state.recordingId);
    
    // Reset internal state
    resetRecording();
    
    // Allow the dialog to close
    setIsClosing(false);
    
  }, [state.isFullyReady, state.recordingId, onRecordingCreated, resetRecording]);
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Only reset if we're not in the middle of closing
      if (!isClosing) {
        resetRecording();
      }
    }
  }, [isOpen, isClosing]);  // Remove resetRecording from dependency array to prevent infinite loop
  
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
  
  // Handle start recording with type
  const handleStartRecording = () => {
    startRecording(recordingType);
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
          {/* Recording Type Selector - Only show before recording starts */}
          {state.recordingState === "idle" && (
            <div className="w-full mb-6">
              <Label htmlFor="recording-type" className="mb-2 block">
                {language === 'ar' ? 'نوع التسجيل' : 'Recording Type'}
              </Label>
              <Select 
                value={recordingType} 
                onValueChange={setRecordingType}
              >
                <SelectTrigger id="recording-type" className="w-full">
                  <SelectValue placeholder={language === 'ar' ? 'اختر نوع التسجيل' : 'Select recording type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="note">{language === 'ar' ? 'ملاحظة' : 'Note'}</SelectItem>
                  <SelectItem value="summary">{language === 'ar' ? 'ملخص' : 'Summary'}</SelectItem>
                  <SelectItem value="lecture">{language === 'ar' ? 'محاضرة' : 'Lecture'}</SelectItem>
                  <SelectItem value="meeting">{language === 'ar' ? 'اجتماع' : 'Meeting'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          {/* Status display */}
          <div className="text-center mb-6">
            <p className="text-lg font-medium">
              {getStatusText()}
            </p>
            
            {/* Show timer during recording */}
            {state.recordingState === "recording" && (
              <div className="text-xl font-mono mt-2">
                {formatRecordingTime(state.recordingTime)} / {formatRecordingTime(MAX_RECORDING_DURATION)}
              </div>
            )}
            
            {/* Show progress during processing */}
            {state.recordingState === "processing" && (
              <div className="w-full mt-4">
                <Progress value={state.progress || 10} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">
                  {state.progress || ''}
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
                onClick={handleStartRecording}
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
          
          {/* Visual feedback while recording */}
          {state.recordingState === "recording" && (
            <div className="mt-6 flex justify-center items-center w-full">
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div 
                    key={i}
                    className="w-1.5 bg-primary rounded-full"
                    style={{
                      height: `${10 + Math.random() * 30}px`,
                      animationDuration: `${0.6 + Math.random() * 0.7}s`,
                      animationDelay: `${Math.random() * 0.5}s`
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4">
          {!isProcessing && state.recordingState !== "error" && (
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
