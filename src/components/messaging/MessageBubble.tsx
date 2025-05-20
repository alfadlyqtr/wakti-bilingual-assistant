
import { useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MessageBubbleProps {
  message: {
    id: string;
    sender_id: string;
    message_type: 'text' | 'image'; // Removed 'voice' type
    content?: string;
    media_url?: string;
    media_type?: string;
    created_at: string;
    sender?: {
      display_name: string;
      username: string;
    };
  };
  isSelf: boolean;
  contactName: string;
}

export function MessageBubble({ message, isSelf, contactName }: MessageBubbleProps) {
  const { theme } = useTheme();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  
  // Format message timestamp
  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      let hours = date.getHours();
      const minutes = date.getMinutes().toString().padStart(2, "0");
      const ampm = hours >= 12 ? "pm" : "am";
      hours = hours % 12;
      hours = hours ? hours : 12; // Handle midnight (0 hours)
      return `${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return "";
    }
  };

  // Determine message styles based on sender
  const bubbleStyle = isSelf
    ? "bg-blue-500 text-white ml-auto rounded-2xl rounded-br-none"
    : "bg-muted text-foreground mr-auto rounded-2xl rounded-bl-none";

  // Render different message types
  const renderMessageContent = () => {
    switch (message.message_type) {
      case 'image':
        return (
          <div className="relative">
            {!isImageLoaded && <div className="h-40 w-40 bg-muted animate-pulse rounded"></div>}
            <img 
              src={message.media_url} 
              alt="Image message" 
              className={`max-h-60 max-w-60 rounded-lg object-contain ${!isImageLoaded ? 'hidden' : ''}`}
              onLoad={() => setIsImageLoaded(true)}
            />
          </div>
        );
      // Removed voice message case
      default:
        return <p className="break-words">{message.content}</p>;
    }
  };

  return (
    <div className={`flex flex-col max-w-[80%] ${isSelf ? 'ml-auto' : 'mr-auto'}`}>
      {!isSelf && message.sender && (
        <span className="text-xs text-muted-foreground ml-2 mb-1">
          {message.sender.display_name || message.sender.username || contactName}
        </span>
      )}
      <div className={`px-4 py-2 ${bubbleStyle}`}>
        {renderMessageContent()}
      </div>
      <div className={`text-xs text-muted-foreground mt-1 ${isSelf ? 'text-right mr-2' : 'ml-2'}`}>
        {formatTime(message.created_at)}
      </div>
    </div>
  );
}
