import React, { useEffect, useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle } from 'lucide-react';
import { useRecordingStore } from './hooks/useRecordingStore';
import { useRecordingHandlers } from './hooks/useRecordingHandlers';
import { useTranscription } from './hooks/useTranscription';
import { useSummaryHandlers } from './hooks/useSummaryHandlers';

import IntakeForm from './IntakeForm';
import RecordingControls from './RecordingControls';
import TranscriptionPanel from './TranscriptionPanel';
import SummaryPanel from './SummaryPanel';
import SummaryExporter from './SummaryExporter';

interface RecordingToolProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingCreated: (recordingId: string) => void;
}

const RecordingTool: React.FC<RecordingToolProps> = ({
  isOpen,
  onClose,
  onRecordingCreated
}) => {
  const { language } = useTheme();
  const { user } = useAuth();
  
  const [isClosing, setIsClosing] = useState(false);
  
  const {
    currentStep,
    processingStage,
    progress,
    recordingId,
    errorMessage,
    reset,
    setCurrentStep,
  } = useRecordingStore();
  
  const { stopRecording, uploadRecording } = useRecordingHandlers();
  const { transcribeAudio } = useTranscription();
  const { generateSummary } = useSummaryHandlers();
  
  // Handle dialog states
  useEffect(() => {
    if (!isOpen) {
      if (!isClosing) {
        reset();
      }
    }
  }, [isOpen, isClosing, reset]);
  
  // Process uploaded recording
  useEffect(() => {
    const processRecording = async () => {
      if (currentStep === 'processing' && processingStage === 'uploading' && user) {
        // Wait for upload to complete
        const uploadedId = await uploadRecording();
        if (uploadedId) {
          // Start transcription
          const transcriptionSuccess = await transcribeAudio(user.id);
          if (transcriptionSuccess) {
            // Generate summary
            await generateSummary();
          }
        }
      }
    };
    
    processRecording();
  }, [currentStep, processingStage, uploadRecording, transcribeAudio, generateSummary, user]);
  
  // When a recording is fully completed, notify parent component
  useEffect(() => {
    if (currentStep === 'complete' && recordingId) {
      onRecordingCreated(recordingId);
      
      // Allow the dialog to close normally
      setIsClosing(false);
    }
  }, [currentStep, recordingId, onRecordingCreated]);
  
  // Handle form submission
  const handleIntakeSubmit = () => {
    setCurrentStep('recording');
  };
  
  // Handle starting the processing workflow
  const handleStartProcessing = async () => {
    await stopRecording();
    setCurrentStep('processing');
  };
  
  // Handle dialog close
  const handleDialogClose = async () => {
    // If recording, stop first
    if (currentStep === 'recording') {
      await stopRecording();
      onClose();
      return;
    }
    
    // If processing, don't close immediately
    if (currentStep === 'processing') {
      setIsClosing(true);
      return;
    }
    
    // Otherwise reset and close
    reset();
    onClose();
  };
  
  // Render the current step
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'idle':
        return <IntakeForm onSubmit={handleIntakeSubmit} />;
      
      case 'recording':
        return (
          <div className="flex flex-col items-center gap-8 py-4">
            <RecordingControls />
            
            <div className="flex justify-end w-full">
              <Button onClick={handleStartProcessing}>
                {language === 'ar' ? 'إنهاء وبدء المعالجة' : 'Finish & Process'}
              </Button>
            </div>
          </div>
        );
      
      case 'processing':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {language === 'ar' ? 'جارٍ المعالجة...' : 'Processing...'}
            </p>
            <p className="text-muted-foreground text-sm text-center">
              {getProcessingStageText()}
            </p>
            <Progress value={progress || 10} className="w-full h-2" />
            
            {isClosing && (
              <p className="text-amber-500 text-sm">
                {language === 'ar' 
                  ? 'المعالجة ستستمر في الخلفية. سيظهر التسجيل عند الانتهاء.'
                  : 'Processing will continue in the background. The recording will appear when completed.'}
              </p>
            )}
          </div>
        );
      
      case 'transcript':
      case 'summary':
      case 'complete':
        return (
          <div className="flex flex-col gap-6 py-2">
            <TranscriptionPanel />
            <SummaryPanel />
            <SummaryExporter />
          </div>
        );
      
      case 'error':
        return (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-lg font-medium text-red-600 dark:text-red-400">
              {language === 'ar' ? 'حدث خطأ' : 'An error occurred'}
            </p>
            <p className="text-muted-foreground">
              {errorMessage || (language === 'ar' ? 'حدث خطأ غير معروف' : 'An unknown error occurred')}
            </p>
            <Button 
              variant="outline" 
              onClick={() => reset()}
              className="mt-2"
            >
              {language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}
            </Button>
          </div>
        );
    }
  };
  
  // Get text description for current processing stage
  const getProcessingStageText = () => {
    switch (processingStage) {
      case 'uploading':
        return language === 'ar' ? 'جارٍ تحميل الملف...' : 'Uploading audio...';
      case 'transcribing':
        return language === 'ar' ? 'جارٍ التعرف على الصوت...' : 'Transcribing audio...';
      case 'summarizing':
        return language === 'ar' ? 'جارٍ إنشاء الملخص...' : 'Generating summary...';
      case 'generating_tts':
        return language === 'ar' ? 'جارٍ إنشاء الصوت...' : 'Generating audio...';
      case 'finalizing':
        return language === 'ar' ? 'جارٍ الإنهاء...' : 'Finalizing...';
      default:
        return language === 'ar' ? 'جارٍ المعالجة...' : 'Processing...';
    }
  };
  
  // Get title for the current dialog state
  const getDialogTitle = () => {
    switch (currentStep) {
      case 'idle':
        return language === 'ar' ? 'تسجيل صوتي جديد' : 'New Recording';
      case 'recording':
        return language === 'ar' ? 'جارٍ التسجيل' : 'Recording';
      case 'processing':
        return language === 'ar' ? 'جارٍ المعالجة' : 'Processing';
      case 'transcript':
      case 'summary':
      case 'complete':
        return language === 'ar' ? 'نتائج التسجيل' : 'Recording Results';
      case 'error':
        return language === 'ar' ? 'خطأ' : 'Error';
      default:
        return language === 'ar' ? 'تسجيل صوتي' : 'Voice Recording';
    }
  };
  
  // Determine if the cancel button should be disabled
  const isCancelDisabled = isClosing || (currentStep === 'processing' && !isClosing);
  
  return (
    <Dialog 
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isClosing) {
          handleDialogClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>
        
        <div className="py-2">
          {renderCurrentStep()}
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4">
          {currentStep !== 'error' && currentStep !== 'processing' && currentStep !== 'complete' && (
            <Button variant="outline" onClick={handleDialogClose}>
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </Button>
          )}
          
          {currentStep === 'processing' && (
            <Button variant="outline" disabled={isCancelDisabled}>
              {isClosing 
                ? (language === 'ar' ? 'جارٍ الإغلاق...' : 'Closing...') 
                : (language === 'ar' ? 'انتظر من فضلك...' : 'Please wait...')}
            </Button>
          )}
          
          {currentStep === 'complete' && (
            <Button onClick={() => {
              reset();
              onClose();
            }}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RecordingTool;
