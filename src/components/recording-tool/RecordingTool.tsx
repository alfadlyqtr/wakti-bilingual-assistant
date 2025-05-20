
import React, { useState, useEffect } from "react";
import { IntakeForm } from "./IntakeForm";
import { RecordingControls } from "./RecordingControls";
import { TranscriptionPanel } from "./TranscriptionPanel";
import { SummaryPanel } from "./SummaryPanel";
import { SummaryExporter } from "./SummaryExporter";
import { useRecordingHandlers } from "./hooks/useRecordingHandlers";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { useTranscription } from "./hooks/useTranscription";
import { useSummaryHandlers } from "./hooks/useSummaryHandlers";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export const RecordingTool: React.FC = () => {
  const [summaryId, setSummaryId] = useState<string | undefined>();
  const { uploadRecording } = useRecordingHandlers();
  const { transcribeRecording } = useTranscription();
  const { generateSummary, pollSummaryStatus } = useSummaryHandlers();
  const { language } = useTheme();
  
  const { 
    status,
    audioBlob,
    transcription,
    summary,
    error,
    reset
  } = useRecordingStore();
  
  // Handle automatic upload and transcription when audio is ready
  useEffect(() => {
    const processAudio = async () => {
      if (status === 'stopped' && audioBlob) {
        // Start the upload process
        const audioUrl = await uploadRecording();
        
        if (audioUrl) {
          // Start transcription
          const newSummaryId = await transcribeRecording(audioUrl);
          
          if (newSummaryId) {
            setSummaryId(newSummaryId);
          }
        }
      }
    };
    
    processAudio();
  }, [status, audioBlob, uploadRecording, transcribeRecording]);
  
  // Poll for summary status if we're in summarizing state and have a summaryId
  useEffect(() => {
    if (status === 'summarizing' && summaryId) {
      const pollInterval = setInterval(async () => {
        const isComplete = await pollSummaryStatus(summaryId);
        if (isComplete) {
          clearInterval(pollInterval);
        }
      }, 3000); // Poll every 3 seconds
      
      return () => clearInterval(pollInterval);
    }
  }, [status, summaryId, pollSummaryStatus]);

  const handleTranscriptionComplete = async (id: string) => {
    setSummaryId(id);
    
    // If we have a transcript but no summary yet, start generating summary
    if (transcription && !summary && status !== 'summarizing') {
      await generateSummary(id);
    }
  };

  const handleReset = () => {
    reset();
    setSummaryId(undefined);
  };

  const renderContent = () => {
    switch (status) {
      case 'idle':
      case 'recording':
      case 'paused':
        return (
          <>
            <IntakeForm />
            <RecordingControls />
          </>
        );
      
      case 'stopped':
        return (
          <div className="flex justify-center items-center my-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{t("uploading_recording", language)}</p>
            </div>
          </div>
        );
      
      case 'uploading':
        return (
          <div className="flex justify-center items-center my-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p>{t("uploading_recording", language)}</p>
            </div>
          </div>
        );
      
      case 'transcribing':
      case 'summarizing':
        return (
          <>
            <TranscriptionPanel
              summaryId={summaryId}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
            {status === 'summarizing' && <SummaryPanel />}
          </>
        );
      
      case 'complete':
        return (
          <>
            <TranscriptionPanel
              summaryId={summaryId}
              onTranscriptionComplete={handleTranscriptionComplete}
            />
            <SummaryPanel />
            <SummaryExporter summaryId={summaryId} />
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                {t("new_recording", language)}
              </Button>
            </div>
          </>
        );
      
      case 'error':
        return (
          <div className="flex flex-col items-center gap-4 my-8">
            <div className="text-destructive text-center max-w-md">
              <p>{error || t("unknown_error", language)}</p>
            </div>
            <Button
              onClick={handleReset}
              className="flex gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t("try_again", language)}
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      {renderContent()}
    </div>
  );
};
