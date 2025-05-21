
import React, { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { TasjeelRecord } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/toast-helper";
import {
  FileText,
  Download,
  Trash,
  ChevronDown,
  ChevronUp,
  Edit,
  Save,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AudioControls from "./AudioControls";

interface CompactRecordingCardProps {
  recording: TasjeelRecord;
  onDelete: (id: string) => Promise<void>;
  onExportToPDF: (content: string | null, isTranscription: boolean, title: string | null) => Promise<void>;
  onDownloadAudio: (url: string, isSummary: boolean, title: string | null) => void;
  translations: any;
}

const CompactRecordingCard: React.FC<CompactRecordingCardProps> = ({
  recording,
  onDelete,
  onExportToPDF,
  onDownloadAudio,
  translations: t
}) => {
  const { language } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(recording.title || "");
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingSummary, setIsPlayingSummary] = useState(false);

  // Format date function
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(language === "ar" ? "ar-SA" : undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Handle title update
  const handleUpdateTitle = async () => {
    try {
      const { error } = await supabase
        .from("tasjeel_records")
        .update({ title })
        .eq("id", recording.id);

      if (error) {
        throw error;
      }
      
      setIsEditing(false);
      toast("Title updated successfully");
    } catch (error) {
      console.error("Error updating title:", error);
      toast("Error updating title");
    }
  };

  // Handle play status changes
  const handlePlayOriginal = (isPlaying: boolean) => {
    setIsPlayingOriginal(isPlaying);
    if (isPlaying && isPlayingSummary) {
      setIsPlayingSummary(false);
    }
  };

  const handlePlaySummary = (isPlaying: boolean) => {
    setIsPlayingSummary(isPlaying);
    if (isPlaying && isPlayingOriginal) {
      setIsPlayingOriginal(false);
    }
  };

  return (
    <Card className="overflow-hidden mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-center">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1"
                placeholder={formatDate(recording.created_at)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUpdateTitle}
                className="h-8 w-8"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsEditing(false);
                  setTitle(recording.title || "");
                }}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <h3 className="font-medium truncate">
                {recording.title || formatDate(recording.created_at)}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditing(true)}
                className="h-6 w-6"
              >
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {recording.duration ? `${recording.duration}s` : ''}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="p-1 h-7"
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {expanded && (
          <>
            <Separator className="my-3" />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recording.original_recording_path && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium">{t.playOriginalAudio}</h4>
                  <AudioControls 
                    audioUrl={recording.original_recording_path}
                    onPlaybackChange={handlePlayOriginal}
                    labels={{
                      play: t.playOriginalAudio,
                      pause: t.pauseAudio,
                      rewind: t.rewindAudio,
                      stop: t.stopAudio,
                      error: t.errorPlayingAudio
                    }}
                  />
                </div>
              )}
              
              {recording.summary_audio_path && (
                <div className="space-y-1">
                  <h4 className="text-xs font-medium">{t.playSummaryAudio}</h4>
                  <AudioControls 
                    audioUrl={recording.summary_audio_path}
                    onPlaybackChange={handlePlaySummary}
                    labels={{
                      play: t.playSummaryAudio,
                      pause: t.pauseAudio,
                      rewind: t.rewindAudio,
                      stop: t.stopAudio,
                      error: t.errorPlayingAudio
                    }}
                  />
                </div>
              )}
            </div>
            
            <Separator className="my-3" />
            
            <div className="flex flex-wrap gap-2">
              {recording.transcription && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs py-1 h-7"
                  onClick={() => onExportToPDF(recording.transcription, true, recording.title)}
                >
                  <FileText className="mr-1 h-3 w-3" /> {t.exportTranscriptionToPDF}
                </Button>
              )}
              
              {recording.summary && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs py-1 h-7"
                  onClick={() => onExportToPDF(recording.summary, false, recording.title)}
                >
                  <FileText className="mr-1 h-3 w-3" /> {t.exportSummaryToPDF}
                </Button>
              )}
              
              {recording.original_recording_path && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs py-1 h-7"
                  onClick={() => onDownloadAudio(recording.original_recording_path, false, recording.title)}
                >
                  <Download className="mr-1 h-3 w-3" /> {t.downloadOriginalAudio}
                </Button>
              )}
              
              {recording.summary_audio_path && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs py-1 h-7"
                  onClick={() => onDownloadAudio(recording.summary_audio_path, true, recording.title)}
                >
                  <Download className="mr-1 h-3 w-3" /> {t.downloadSummaryAudio}
                </Button>
              )}
              
              <Button 
                variant="destructive" 
                size="sm"
                className="text-xs py-1 h-7"
                onClick={() => onDelete(recording.id)}
              >
                <Trash className="mr-1 h-3 w-3" /> {t.deleteRecording}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactRecordingCard;
