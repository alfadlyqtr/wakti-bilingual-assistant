
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Send, X } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => Promise<void>;
  onCancel: () => void;
}

export function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      
      // Start duration timer
      intervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (audioBlob && audioRef.current) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSend = async () => {
    if (audioBlob) {
      await onRecordingComplete(audioBlob, duration);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Voice Message</div>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-4">
        {!isRecording && !audioBlob && (
          <Button onClick={startRecording} className="flex-1">
            <Mic className="h-4 w-4 mr-2" />
            Start Recording
          </Button>
        )}

        {isRecording && (
          <>
            <Button onClick={stopRecording} variant="destructive" className="flex-1">
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
            <div className="text-sm text-muted-foreground">
              {formatTime(duration)}
            </div>
          </>
        )}

        {audioBlob && (
          <>
            <Button
              onClick={isPlaying ? pauseRecording : playRecording}
              variant="outline"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="text-sm text-muted-foreground flex-1">
              Duration: {formatTime(duration)}
            </div>
            <Button onClick={handleSend} disabled={!audioBlob}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </>
        )}
      </div>

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
      />
    </div>
  );
}
