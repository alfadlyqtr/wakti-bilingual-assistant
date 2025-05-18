
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/ThemeProvider";
import { Play, Pause, RotateCcw, Download } from "lucide-react";
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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
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
            >
              {isGenerating
                ? language === "ar"
                  ? "جار الإنشاء..."
                  : "Generating..."
                : language === "ar"
                ? "إنشاء"
                : "Generate"}
            </Button>
          )}
        </div>
      </div>

      {audioUrl && (
        <div className="flex flex-col space-y-2">
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="hidden"
          />
          
          <div className="flex flex-wrap items-center gap-2">
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
