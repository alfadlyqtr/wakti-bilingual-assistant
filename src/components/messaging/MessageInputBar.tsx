
import { useState, useRef } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

// Maximum character limit for text messages
const MAX_CHARS = 300;

interface MessageInputBarProps {
  onSendMessage: (message: any) => void;
  isSubmitting?: boolean;
}

export function MessageInputBar({ onSendMessage, isSubmitting = false }: MessageInputBarProps) {
  const { language } = useTheme();
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Character count display
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

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
          disabled={isSubmitting || isUploading}
        >
          <Plus className="h-5 w-5" />
        </Button>

        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("typeMessage", language)}
          className="flex-1 bg-transparent border-0 focus-visible:ring-0 placeholder-muted-foreground text-foreground h-10 py-0 px-2"
          disabled={isSubmitting || isUploading}
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
            {/* Removed voice recording button and functionality */}
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

      {/* Removed voice recording UI */}

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
