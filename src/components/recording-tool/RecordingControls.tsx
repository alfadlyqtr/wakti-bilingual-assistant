
import React from 'react';
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Mic, Square, Pause, Play } from "lucide-react";
import { useRecordingHandlers } from './hooks/useRecordingHandlers';
import { useRecordingStore } from './hooks/useRecordingStore';
import { MAX_RECORDING_DURATION } from './hooks/useRecordingHandlers';

export const formatRecordingTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
};

const RecordingControls: React.FC = () => {
  const { language } = useTheme();
  const { recordingDuration } = useRecordingStore();
  const { 
    isRecording, 
    isPaused,
    startRecording, 
    stopRecording, 
    pauseRecording,
    resumeRecording,
  } = useRecordingHandlers();
  
  return (
    <div className="flex flex-col items-center">
      {isRecording && (
        <div className="text-2xl font-mono mb-4">
          {formatRecordingTime(recordingDuration)} / {formatRecordingTime(MAX_RECORDING_DURATION)}
        </div>
      )}
      
      <div className="flex items-center justify-center gap-4">
        {!isRecording && (
          <Button
            onClick={startRecording}
            size="lg"
            className="h-16 w-16 rounded-full"
          >
            <Mic className="h-8 w-8" />
          </Button>
        )}
        
        {isRecording && isPaused && (
          <Button
            onClick={resumeRecording}
            variant="secondary"
            size="lg"
            className="h-16 w-16 rounded-full"
          >
            <Play className="h-8 w-8" />
          </Button>
        )}
        
        {isRecording && !isPaused && (
          <Button
            onClick={pauseRecording}
            variant="secondary"
            size="lg"
            className="h-16 w-16 rounded-full"
          >
            <Pause className="h-8 w-8" />
          </Button>
        )}
        
        {isRecording && (
          <Button
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="h-16 w-16 rounded-full"
          >
            <Square className="h-8 w-8" />
          </Button>
        )}
      </div>
      
      {isRecording && (
        <div className="mt-6 flex justify-center items-center w-full">
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i}
                className="w-1.5 bg-primary rounded-full animate-pulse"
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
      
      {!isRecording && (
        <div className="mt-4 text-sm text-muted-foreground">
          {language === 'ar' 
            ? 'انقر على زر الميكروفون للبدء' 
            : 'Click the microphone button to start'}
        </div>
      )}
    </div>
  );
};

export default RecordingControls;
