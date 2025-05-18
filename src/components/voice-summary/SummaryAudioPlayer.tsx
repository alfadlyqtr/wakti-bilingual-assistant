
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Play, Pause, RotateCcw, Download, Volume, Volume2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SummaryAudioPlayerProps {
  recordingId: string;
  summaryText: string;
  existingAudioUrl?: string | null;
  onAudioGenerated?: (url: string) => void;
}

export default function SummaryAudioPlayer({
  recordingId,
  summaryText,
  existingAudioUrl,
  onAudioGenerated,
}: SummaryAudioPlayerProps) {
  const { language, theme } = useTheme();
  const [audioUrl, setAudioUrl] = useState<string | null>(existingAudioUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [voiceGender, setVoiceGender] = useState<"male" | "female">("male");
  const [audioLanguage, setAudioLanguage] = useState<"en" | "ar">(language === "ar" ? "ar" : "en");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update audio progress
  const startProgressTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }
    
    intervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        setProgress(audioRef.current.currentTime);
      }
    }, 100);
  };

  const stopProgressTimer = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleGenerateAudio = async () => {
    if (!summaryText) {
      toast.error(language === "ar" ? "لا يوجد ملخص لتوليد الصوت" : "No summary to generate audio");
      return;
    }

    try {
      setIsGenerating(true);
      
      // Get auth session for API call
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        throw new Error('No auth session');
      }
      
      // Call the generate-tts edge function
      const response = await fetch(
        "https://hxauxozopvpzpdygoqwf.supabase.co/functions/v1/generate-tts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({
            recordingId,
            voiceGender,
            language: audioLanguage,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate audio");
      }

      const result = await response.json();
      setAudioUrl(result.audioUrl);
      
      if (onAudioGenerated) {
        onAudioGenerated(result.audioUrl);
      }
      
      toast.success(
        language === "ar"
          ? "تم إنشاء الصوت بنجاح"
          : "Audio generated successfully"
      );
    } catch (error) {
      console.error("Error generating audio:", error);
      toast.error(
        language === "ar"
          ? `فشل في إنشاء الصوت: ${error.message}`
          : `Failed to generate audio: ${error.message}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlay = () => {
    if (audioRef.current) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          startProgressTimer();
        })
        .catch((error) => {
          console.error("Error playing audio:", error);
          toast.error(
            language === "ar"
              ? "فشل في تشغيل الصوت"
              : "Failed to play audio"
          );
        });
    }
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopProgressTimer();
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
          startProgressTimer();
        })
        .catch((error) => {
          console.error("Error restarting audio:", error);
        });
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const link = document.createElement("a");
      link.href = audioUrl;
      link.download = `summary-${recordingId}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-medium">
            {language === "ar" ? "تشغيل الملخص" : "Play Summary"}
          </Badge>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select
            value={voiceGender}
            onValueChange={(value) => setVoiceGender(value as "male" | "female")}
            disabled={isGenerating || isPlaying}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder={language === "ar" ? "الصوت" : "Voice"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{language === "ar" ? "ذكر" : "Male"}</SelectItem>
              <SelectItem value="female">{language === "ar" ? "أنثى" : "Female"}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={audioLanguage}
            onValueChange={(value) => setAudioLanguage(value as "en" | "ar")}
            disabled={isGenerating || isPlaying}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder={language === "ar" ? "اللغة" : "Language"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>

          {!audioUrl && (
            <Button
              onClick={handleGenerateAudio}
              disabled={isGenerating || !summaryText}
              variant="outline"
              size="sm"
              className="gap-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {language === "ar" ? "جارٍ الإنشاء..." : "Generating..."}
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-1" />
                  {language === "ar" ? "إنشاء الصوت" : "Generate Audio"}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {audioUrl && (
        <div className="flex flex-col space-y-2 border rounded-md p-3">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => {
              setIsPlaying(false);
              stopProgressTimer();
              setProgress(0);
            }}
            onPause={() => {
              setIsPlaying(false);
              stopProgressTimer();
            }}
            onPlay={() => {
              setIsPlaying(true);
              startProgressTimer();
            }}
            onLoadedMetadata={(e) => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration);
              }
            }}
            className="hidden"
          />
          
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">
              {formatTime(progress)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(duration)}
            </span>
          </div>
          
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full" 
              style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }}
            ></div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {isPlaying ? (
              <Button 
                onClick={handlePause} 
                size="sm" 
                variant="outline"
                className="gap-1"
              >
                <Pause className="h-4 w-4" />
                {language === "ar" ? "إيقاف" : "Pause"}
              </Button>
            ) : (
              <Button 
                onClick={handlePlay} 
                size="sm" 
                variant="outline"
                className="gap-1"
              >
                <Play className="h-4 w-4" />
                {language === "ar" ? "تشغيل" : "Play"}
              </Button>
            )}
            
            <Button 
              onClick={handleRestart} 
              size="sm" 
              variant="outline"
              className="gap-1"
            >
              <RotateCcw className="h-4 w-4" />
              {language === "ar" ? "إعادة" : "Restart"}
            </Button>
            
            <Button 
              onClick={handleDownload} 
              size="sm" 
              variant="outline"
              className="gap-1"
            >
              <Download className="h-4 w-4" />
              {language === "ar" ? "تنزيل" : "Download"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
