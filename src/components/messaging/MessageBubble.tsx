
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { format, formatDistanceToNow } from "date-fns";
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
    ? `bg-primary text-primary-foreground rounded-t-2xl rounded-bl-2xl rounded-br-sm`
    : `bg-secondary text-secondary-foreground rounded-t-2xl rounded-br-2xl rounded-bl-sm`;

  return (
    <div 
      className={cn(
        "flex flex-col",
        isSelf ? "items-end" : "items-start"
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
                className="h-8 w-8 rounded-full p-0"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <div className="flex-1">
                {/* Audio waveform visualization */}
                <div className="h-6 bg-secondary/20 dark:bg-secondary/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary/50 dark:bg-secondary/70 rounded-full" 
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
              className="h-6 px-2 text-xs flex items-center gap-1"
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
              <div className="text-xs p-2 bg-black/5 dark:bg-white/5 rounded-md">
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
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span>{formatTime(message.timestamp)}</span>
        <span>•</span>
        <span>🕒 {t("expiresIn", language)} {hoursRemaining}h</span>
      </div>
    </div>
  );
}
