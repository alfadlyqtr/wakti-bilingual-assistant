
import React, { useRef, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause } from "lucide-react";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export const SummaryPanel: React.FC = () => {
  const { summary, summaryAudioUrl, status } = useRecordingStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { language } = useTheme();

  const togglePlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  if (status === 'summarizing') {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("generating_summary", language)}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>{t("summarizing_message", language)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("summary", language)}</CardTitle>
          {summaryAudioUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex gap-2"
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  {t("pause", language)}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {t("play_summary", language)}
                </>
              )}
            </Button>
          )}
          {summaryAudioUrl && (
            <audio
              ref={audioRef}
              src={summaryAudioUrl}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              hidden
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap text-base leading-7">{summary}</div>
      </CardContent>
    </Card>
  );
};
