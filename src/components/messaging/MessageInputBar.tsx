
import { useState, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Plus, Send, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Maximum character limit for text messages
const MAX_CHARS = 300;

// Maximum recording time for voice messages (in seconds)
const MAX_RECORDING_TIME = 30;

interface MessageInputBarProps {
  onSendMessage: (message: any) => void;
  isSubmitting?: boolean;
}

export function MessageInputBar({ onSendMessage, isSubmitting = false }: MessageInputBarProps) {
  const { language } = useTheme();
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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
        message_type: "voice",
        content: `Voice message (${recordingTime}s)`,
      });
    }
    
    setRecordingTime(0);
  };

  // Handle image selection
  const handleImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert(t("imageTooLarge", language));
      return;
    }

    try {
      setIsUploading(true);
      // Upload the image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('message_media')
        .upload(`images/${fileName}`, file);

      if (uploadError) {
        console.error("Error uploading image:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = await supabase.storage
        .from('message_media')
        .getPublicUrl(`images/${fileName}`);

      // Send the image message
      onSendMessage({
        message_type: "image",
        media_url: urlData.publicUrl,
        media_type: file.type,
        content: "📷 Image"
      });
    } catch (error) {
      console.error("Error processing image:", error);
    } finally {
      setIsUploading(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Send text message
  const sendTextMessage = () => {
    if (text.trim() && !isOverLimit) {
      onSendMessage({
        message_type: "text",
        content: text.trim(),
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
          disabled={isSubmitting || isUploading || isRecording}
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage", language)}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 placeholder-muted-foreground text-foreground h-10 py-0 px-2"
          disabled={isRecording || isSubmitting || isUploading}
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
            disabled={isOverLimit || isSubmitting || isUploading}
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
              disabled={isRecording || isSubmitting || isUploading}
            >
              <Mic className="h-5 w-5" />
            </Button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelected}
              disabled={isSubmitting || isUploading}
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

      {/* Uploading indicator */}
      {isUploading && (
        <div className="mt-2 flex items-center justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-xs">
            <span className="animate-pulse">{t("uploading", language)}...</span>
          </div>
        </div>
      )}
    </div>
  );
}
