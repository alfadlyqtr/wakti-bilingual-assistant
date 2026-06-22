
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, onRecordingStart, onRecordingStop, disabled }: VoiceRecorderProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const MAX_DURATION = 30; // 30 seconds

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      onRecordingStart?.();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Unable to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStop?.();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const sendRecording = () => {
    if (audioBlob && recordingTime > 0) {
      onRecordingComplete(audioBlob, recordingTime);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  const discardRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioBlob) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg border",
        isDark ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-transparent"
      )}>
        <Button
          size="sm"
          variant="ghost"
          onClick={isPlaying ? pauseRecording : playRecording}
          className={cn("h-8 w-8 p-0", isDark ? "text-foreground hover:bg-white/10" : "text-foreground hover:bg-blue-100")}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className={cn("text-sm font-mono", isDark ? "text-foreground" : "text-gray-700")}>{formatTime(recordingTime)}</span>
        <Button size="sm" onClick={sendRecording} className="h-7 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white">
          Send
        </Button>
        <Button size="sm" variant="outline" onClick={discardRecording} className={cn("h-7 px-3 text-xs", isDark ? "border-white/20 text-foreground hover:bg-white/10" : "")}>
          Discard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">Recording</span>
          </div>
          <span className="text-sm font-mono font-bold text-red-600">
            {formatTime(recordingTime)} / {formatTime(MAX_DURATION)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={stopRecording}
            className="h-7 w-7 p-0 ml-1 text-red-600 hover:bg-red-500/20 hover:text-red-700"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={startRecording}
          disabled={disabled}
          className={cn("h-8 w-8 p-0", isDark ? "hover:bg-white/10" : "hover:bg-blue-50")}
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
