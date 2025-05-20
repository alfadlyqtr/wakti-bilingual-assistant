
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
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Initialize audio element when component mounts or when audioUrl changes
  useEffect(() => {
    if (audioUrl && !audioRef.current) {
      const audio = new Audio(audioUrl);
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };
      audio.onended = () => {
        setIsPlaying(false);
        stopProgressTimer();
        setProgress(0);
      };
      audio.onpause = () => {
        setIsPlaying(false);
        stopProgressTimer();
      };
      audio.onplay = () => {
        setIsPlaying(true);
        startProgressTimer();
      };
      audio.onerror = () => {
        console.error("Audio playback error");
        toast.error(
          language === "ar" 
            ? "حدث خطأ أثناء تشغيل الصوت" 
            : "Error playing audio"
        );
        setIsPlaying(false);
        stopProgressTimer();
      };
      audioRef.current = audio;
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [audioUrl, language]);

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
            text: summaryText, // Add text explicitly
            voiceGender,
            language: audioLanguage,
          }),
        }
      );

      const result = await response.json();
      
      if (!response.ok || !result.audioUrl) {
        const errorMessage = result.error || "Failed to generate audio";
        console.error("TTS generation failed:", errorMessage, result);
        throw new Error(errorMessage);
      }
      
      // Create audio element with the new URL
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      setAudioUrl(result.audioUrl);
      
      if (onAudioGenerated) {
        onAudioGenerated(result.audioUrl);
      }
      
      toast.success(
        language === "ar"
          ? "تم إنشاء الصوت بنجاح"
          : "Audio generated successfully"
      );
      
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error("Error generating audio:", error);
      
      // Implement retry logic
      if (retryCount < maxRetries) {
        setRetryCount(prevCount => prevCount + 1);
        toast.warning(
          language === "ar"
            ? `إعادة المحاولة ${retryCount + 1}/${maxRetries}...`
            : `Retrying ${retryCount + 1}/${maxRetries}...`
        );
        
        // Wait briefly before retrying
        setTimeout(() => {
          handleGenerateAudio();
        }, 2000);
        return;
      }
      
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
    if (!audioRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };
      audio.onended = () => {
        setIsPlaying(false);
        stopProgressTimer();
        setProgress(0);
      };
      audio.onpause = () => {
        setIsPlaying(false);
        stopProgressTimer();
      };
      audio.onplay = () => {
        setIsPlaying(true);
        startProgressTimer();
      };
      audioRef.current = audio;
    }
    
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
      
      toast.success(
        language === "ar"
          ? "جارٍ تنزيل الملف الصوتي"
          : "Downloading audio file"
      );
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Set direction based on language
  const rtlProps = language === 'ar' ? { dir: 'rtl' } : {};
  
  return (
    <div className="space-y-3" {...rtlProps}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-medium">
            {language === "ar" ? "تشغيل الملخص" : "Play Summary"}
          </Badge>
        </div>

        {!audioUrl && (
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
          </div>
        )}
      </div>

      {audioUrl && (
        <div className="flex flex-col space-y-2 border rounded-md p-3">
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
              className="h-full bg-primary rounded-full transition-all" 
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
