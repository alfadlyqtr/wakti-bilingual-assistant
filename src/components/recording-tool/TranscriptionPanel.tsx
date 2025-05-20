
import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { useTranscription } from "./hooks/useTranscription";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface TranscriptionPanelProps {
  summaryId?: string;
  onTranscriptionComplete: (summaryId: string) => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  summaryId,
  onTranscriptionComplete
}) => {
  const { transcription, status } = useRecordingStore();
  const [editableTranscript, setEditableTranscript] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const { updateTranscription, pollTranscriptionStatus } = useTranscription();
  const { language } = useTheme();
  
  useEffect(() => {
    if (transcription && !isEditing) {
      setEditableTranscript(transcription);
    }
  }, [transcription, isEditing]);
  
  // Poll for transcription if we're in transcribing state and have a summaryId
  useEffect(() => {
    if (status === 'transcribing' && summaryId) {
      const pollInterval = setInterval(async () => {
        const isComplete = await pollTranscriptionStatus(summaryId);
        if (isComplete) {
          clearInterval(pollInterval);
          onTranscriptionComplete(summaryId);
        }
      }, 3000); // Poll every 3 seconds
      
      return () => clearInterval(pollInterval);
    }
  }, [status, summaryId, pollTranscriptionStatus, onTranscriptionComplete]);

  const handleSave = async () => {
    if (!summaryId) return;
    
    const success = await updateTranscription(summaryId, editableTranscript);
    if (success) {
      setIsEditing(false);
      onTranscriptionComplete(summaryId);
    }
  };

  if (status === 'transcribing') {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("transcribing", language)}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>{t("transcribing_message", language)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transcription) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("transcription", language)}</CardTitle>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                {t("cancel", language)}
              </Button>
              <Button onClick={handleSave}>
                {t("save", language)}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              {t("edit", language)}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Textarea
            className="min-h-[200px] text-base"
            value={editableTranscript}
            onChange={(e) => setEditableTranscript(e.target.value)}
          />
        ) : (
          <div className="whitespace-pre-wrap text-base leading-7">{transcription}</div>
        )}
      </CardContent>
    </Card>
  );
};
