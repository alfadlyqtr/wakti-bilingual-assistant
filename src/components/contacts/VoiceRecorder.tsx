
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/providers/ThemeProvider";
import { cn } from "@/lib/utils";

type VoiceRecorderState = 'idle' | 'recording' | 'preview';

export interface VoiceRecorderHandle {
  send: () => void;
}

interface VoiceRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  onStateChange?: (state: VoiceRecorderState) => void;
  disabled?: boolean;
}

export const VoiceRecorder = forwardRef<VoiceRecorderHandle, VoiceRecorderProps>(function VoiceRecorderInner({ onRecordingComplete, onRecordingStart, onRecordingStop, onStateChange, disabled }, ref) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useImperativeHandle(ref, () => ({
    send: () => {
      if (audioBlobRef.current && recordingTimeRef.current > 0) {
        onRecordingComplete(audioBlobRef.current, recordingTimeRef.current);
        setAudioBlob(null);
        setRecordingTime(0);
      }
    }
  }));

  const audioBlobRef = useRef<Blob | null>(null);
  const recordingTimeRef = useRef<number>(0);

  const MAX_DURATION = 30; // 30 seconds

  useEffect(() => {
    const state: VoiceRecorderState = isRecording ? 'recording' : audioBlob ? 'preview' : 'idle';
    onStateChange?.(state);
  }, [isRecording, audioBlob, onStateChange]);

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
        audioBlobRef.current = blob;
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      onRecordingStart?.();

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const next = prev + 1;
          recordingTimeRef.current = next;
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return next;
        });
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Unable to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    onRecordingStop?.();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const playRecording = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setPlaybackProgress(0);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          const pct = (audio.currentTime / audio.duration) * 100;
          setPlaybackProgress(pct);
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
        URL.revokeObjectURL(audioUrl);
        audioUrlRef.current = null;
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

  const seekAudio = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = pct * audioRef.current.duration;
    audioRef.current.currentTime = newTime;
    setPlaybackProgress(pct * 100);
  };

  const discardRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioBlob(null);
    audioBlobRef.current = null;
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (audioBlob) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-2.5 py-1 rounded-xl border w-full h-9",
        isDark ? "bg-blue-900/20 border-blue-800/30" : "bg-blue-50 border-transparent"
      )}>
        <Button
          size="sm"
          variant="ghost"
          onClick={isPlaying ? pauseRecording : playRecording}
          className={cn("h-7 w-7 p-0", isDark ? "text-foreground hover:bg-white/10" : "text-foreground hover:bg-blue-100")}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className={cn("text-sm font-mono", isDark ? "text-foreground" : "text-gray-700")}>{formatTime(recordingTime)}</span>
        <div className="flex-1 mx-2 cursor-pointer" onClick={seekAudio}>
          <div className={cn(
            "h-1 rounded-full overflow-hidden",
            isDark ? "bg-white/10" : "bg-gray-200"
          )}>
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-100"
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={discardRecording}
          className={cn("h-8 w-8 p-0 text-red-500 hover:bg-red-500/20 hover:text-red-600")}
          aria-label="Discard"
        >
          <Trash2 className="h-6 w-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {isRecording ? (
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-bottom-1 duration-200 w-full h-9">
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
});
