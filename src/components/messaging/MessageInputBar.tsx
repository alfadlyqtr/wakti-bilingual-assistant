
import { useState, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Plus, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Maximum character limit for text messages
const MAX_CHARS = 300;

// Maximum recording time for voice messages (in seconds)
const MAX_RECORDING_TIME = 30;

interface MessageInputBarProps {
  onSendMessage: (message: any) => void;
}

export function MessageInputBar({ onSendMessage }: MessageInputBarProps) {
  const { language } = useTheme();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Character count display
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

  // Start recording voice message
  const startRecording = () => {
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start a timer to track recording duration
    const interval = setInterval(() => {
      setRecordingTime((prevTime) => {
        if (prevTime >= MAX_RECORDING_TIME) {
          stopRecording();
          return MAX_RECORDING_TIME;
        }
        return prevTime + 1;
      });
    }, 1000);
    
    setRecordingInterval(interval);
    
    // In a real app, we would start the actual audio recording here
    console.log("Starting voice recording...");
  };

  // Stop recording voice message
  const stopRecording = () => {
    setIsRecording(false);
    
    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }
    
    // In a real app, we would stop the actual recording and process the audio
    console.log(`Voice recording stopped after ${recordingTime} seconds`);
    
    if (recordingTime > 0) {
      // Mock voice message - in a real app, we would process the actual recording
      onSendMessage({
        type: "voice",
        audioUrl: "/path-to-audio.mp3",
        duration: recordingTime,
        transcript: "This is a mock transcript of the voice message.",
      });
    }
    
    setRecordingTime(0);
  };

  // Handle image selection
  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert(t("imageTooLarge", language));
      return;
    }
    
    // In a real app, we would upload and process the image
    console.log(`Image selected: ${file.name}`);
    
    // Mock image message - in a real app, we would upload the image and get a URL
    onSendMessage({
      type: "image",
      imageUrl: "/placeholder.svg", // Placeholder image URL
    });
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Send text message
  const sendTextMessage = () => {
    if (text.trim() && !isOverLimit) {
      onSendMessage({
        type: "text",
        text: text.trim(),
      });
      setText("");
    }
  };

  return (
    <div className="p-2 border-t border-border bg-background">
      <div className="flex items-center gap-2 bg-muted rounded-full overflow-hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full text-muted-foreground hover:bg-transparent p-0 ml-1"
          onClick={() => fileInputRef.current?.click()}
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage", language)}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 placeholder-muted-foreground text-foreground h-10 py-0 px-2"
          disabled={isRecording}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendTextMessage();
            }
          }}
        />
        
        {text.trim() ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full text-blue-500 hover:bg-transparent p-0 mr-1"
            onClick={sendTextMessage}
            disabled={isOverLimit}
          >
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-muted-foreground hover:bg-transparent p-0"
              onClick={startRecording}
              disabled={isRecording}
            >
              <Mic className="h-5 w-5" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
            />
          </div>
        )}
      </div>

      {/* Recording in progress UI */}
      {isRecording && (
        <div className="mt-2 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
            <span className="animate-pulse">● {recordingTime}s</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 text-white hover:bg-red-600"
              onClick={stopRecording}
            >
              <span className="sr-only">{t("stopRecording", language)}</span>
              ■
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
