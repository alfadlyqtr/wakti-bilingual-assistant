
import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, Send, Square, Image, Paperclip } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSendMessage: (message: string, type?: 'text' | 'voice') => void;
  onFileUpload?: (file: File) => void;
  disabled?: boolean;
  placeholder?: string;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
}

export function ChatInput({
  onSendMessage,
  onFileUpload,
  disabled = false,
  placeholder,
  isRecording = false,
  onStartRecording,
  onStopRecording
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTheme();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, disabled, onSendMessage]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    // Reset input
    e.target.value = '';
  }, [onFileUpload]);

  const handleVoiceToggle = useCallback(() => {
    if (isRecording && onStopRecording) {
      onStopRecording();
    } else if (!isRecording && onStartRecording) {
      onStartRecording();
    }
  }, [isRecording, onStartRecording, onStopRecording]);

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-end gap-2 p-4 border-t bg-background/95 backdrop-blur">
        {/* File Upload Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        {/* Image Upload Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="shrink-0"
        >
          <Image className="h-4 w-4" />
        </Button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || (language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...')}
            disabled={disabled}
            className={cn(
              "min-h-[44px] max-h-[120px] resize-none pr-12",
              "focus:ring-1 focus:ring-primary/20"
            )}
            rows={1}
          />
          
          {/* Send Button */}
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !message.trim()}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8",
              "opacity-0 pointer-events-none transition-opacity",
              message.trim() && !disabled && "opacity-100 pointer-events-auto"
            )}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Voice Recording Button */}
        <Button
          type="button"
          variant={isRecording ? "destructive" : "ghost"}
          size="icon"
          onClick={handleVoiceToggle}
          disabled={disabled}
          className={cn(
            "shrink-0 transition-all duration-200",
            isRecording && "animate-pulse"
          )}
        >
          {isRecording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
    </form>
  );
}
