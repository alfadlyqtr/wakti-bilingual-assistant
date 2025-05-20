
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mic, Square, Play, Pause } from "lucide-react";
import { useRecordingHandlers } from "./hooks/useRecordingHandlers";
import { useRecordingStore } from "./hooks/useRecordingStore";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export const RecordingControls: React.FC = () => {
  const { 
    isRecording,
    isPaused,
    formattedDuration,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording 
  } = useRecordingHandlers();
  
  const { status } = useRecordingStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  const handleStopRecording = async () => {
    stopRecording();
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="relative w-full flex flex-col items-center">
          {/* Recording Timer */}
          <div className="text-3xl font-mono mb-4 text-center">
            {formattedDuration}
          </div>

          {/* Visualization */}
          {isRecording && (
            <div className={`flex items-end justify-center gap-1 mb-6 h-12 transition-all ${isPaused ? 'opacity-50' : 'opacity-100'}`}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-3 rounded-t-full ${isDark ? 'bg-dark-tertiary' : 'bg-light-primary'}`}
                  style={{
                    height: isPaused 
                      ? '16px' 
                      : `${20 + (Math.sin((Date.now() / 200) + idx) + 1) * 15}px`,
                    animation: isPaused ? 'none' : 'pulse 1.2s infinite ease-in-out',
                    animationDelay: `${idx * 0.2}s`
                  }}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="flex flex-wrap gap-3 justify-center">
            {!isRecording ? (
              <Button 
                onClick={startRecording} 
                className="px-8 py-6 h-auto flex gap-2"
                disabled={status !== 'idle'}
              >
                <Mic className="h-5 w-5" />
                {t("start_recording", "en")}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleStopRecording}
                  variant="destructive"
                  className="px-6 py-6 h-auto flex gap-2"
                >
                  <Square className="h-5 w-5" />
                  {t("stop", "en")}
                </Button>
                
                {isPaused ? (
                  <Button 
                    onClick={resumeRecording}
                    variant="outline" 
                    className="px-6 py-6 h-auto flex gap-2"
                  >
                    <Play className="h-5 w-5" />
                    {t("resume", "en")}
                  </Button>
                ) : (
                  <Button 
                    onClick={pauseRecording}
                    variant="outline" 
                    className="px-6 py-6 h-auto flex gap-2"
                  >
                    <Pause className="h-5 w-5" />
                    {t("pause", "en")}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
