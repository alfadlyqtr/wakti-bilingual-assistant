
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { format } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Play, Pause, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: any;
  isSelf: boolean;
  contactName: string;
}

export function MessageBubble({ message, isSelf, contactName }: MessageBubbleProps) {
  const { language, theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  // Calculate time remaining until expiry
  const now = new Date();
  const timeRemaining = message.expiresAt.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60)));
  
  // Calculate opacity based on time remaining (fade out as it gets closer to expiry)
  const opacity = Math.min(1, Math.max(0.5, timeRemaining / (1000 * 60 * 60 * 24)));

  // Format timestamp based on language
  const formatTime = (date: Date) => {
    return format(date, "p", {
      locale: language === "ar" ? arSA : enUS,
    });
  };

  // Message bubble styling based on sender and theme
  const bubbleStyle = isSelf
    ? `bg-blue-500 text-white rounded-2xl rounded-br-sm`
    : `bg-zinc-700 text-white rounded-2xl rounded-bl-sm`;

  return (
    <div 
      className={cn(
        "flex flex-col max-w-[80%]",
        isSelf ? "items-end self-end" : "items-start self-start"
      )}
      style={{ opacity }}
    >
      {/* Message Content */}
      <div 
        className={cn(
          "p-3 max-w-full",
          bubbleStyle
        )}
      >
        {/* Text Message */}
        {message.type === "text" && (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}

        {/* Voice Message */}
        {message.type === "voice" && (
          <div className="w-64 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-full p-0 text-white hover:bg-black/20"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <div className="flex-1">
                {/* Audio waveform visualization */}
                <div className="h-6 bg-black/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white/30 rounded-full" 
                    style={{ width: isPlaying ? "70%" : "0", transition: "width 0.1s linear" }}
                  />
                </div>
              </div>
              
              <span className="text-xs">{message.duration}s</span>
            </div>
            
            {/* Transcript button and content */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs flex items-center gap-1 text-white/80 hover:text-white hover:bg-black/20"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {t("transcript", language)}
              {showTranscript ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            
            {showTranscript && (
              <div className="text-xs p-2 bg-black/20 rounded-md">
                {message.transcript}
              </div>
            )}
          </div>
        )}

        {/* Image Message */}
        {message.type === "image" && (
          <div 
            className={cn(
              "relative cursor-pointer overflow-hidden",
              isImageExpanded ? "max-w-xs" : "w-64 h-48"
            )}
            onClick={() => setIsImageExpanded(!isImageExpanded)}
          >
            <img 
              src={message.imageUrl || "/placeholder.svg"} 
              alt="Shared image" 
              className={cn(
                "object-cover rounded-md transition-all",
                isImageExpanded ? "w-full" : "w-full h-full"
              )}
            />
          </div>
        )}
      </div>

      {/* Time and expiry info */}
      <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
        <span>{formatTime(message.timestamp)}</span>
        <span>•</span>
        <span>🕒 {hoursRemaining}h</span>
      </div>
    </div>
  );
}
