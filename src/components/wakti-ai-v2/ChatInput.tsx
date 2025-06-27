
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Mic, MicOff, Loader2, Plus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useBrowserSpeechRecognition } from '@/hooks/useBrowserSpeechRecognition';
import { VisionFileUpload } from './VisionFileUpload';
import { VisionUploadedFile } from '@/hooks/useVisionFileUpload';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  onSendMessage: (message: string, inputType?: 'text' | 'voice', files?: VisionUploadedFile[]) => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  showVoiceInput?: boolean;
  onVoiceRecognitionStart?: () => void;
  onVoiceRecognitionEnd?: () => void;
}

export function ChatInput({
  message,
  setMessage,
  onSendMessage,
  isLoading,
  disabled = false,
  placeholder,
  showVoiceInput = true,
  onVoiceRecognitionStart,
  onVoiceRecognitionEnd
}: ChatInputProps) {
  const { language } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<VisionUploadedFile[]>([]);
  
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    isSupported
  } = useBrowserSpeechRecognition();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // Handle speech recognition transcript
  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript, setMessage]);

  // Handle speech recognition callbacks
  useEffect(() => {
    if (isListening && onVoiceRecognitionStart) {
      onVoiceRecognitionStart();
    } else if (!isListening && onVoiceRecognitionEnd) {
      onVoiceRecognitionEnd();
    }
  }, [isListening, onVoiceRecognitionStart, onVoiceRecognitionEnd]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() || uploadedFiles.length > 0) {
      onSendMessage(message.trim(), 'text', uploadedFiles);
      setMessage('');
      setUploadedFiles([]);
      setShowFileUpload(false);
      clearTranscript();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleFilesChange = (files: VisionUploadedFile[]) => {
    setUploadedFiles(files);
  };

  const defaultPlaceholder = language === 'ar' 
    ? 'اكتب رسالتك هنا...' 
    : 'Type your message here...';

  return (
    <div className="w-full space-y-3">
      {showFileUpload && (
        <div className="bg-muted/50 rounded-lg p-3 border">
          <VisionFileUpload 
            onFilesChange={handleFilesChange}
            disabled={disabled || isLoading}
          />
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder || defaultPlaceholder}
            disabled={disabled || isLoading}
            className="min-h-[44px] max-h-32 resize-none pr-12"
            rows={1}
          />
          
          {/* Plus button for file upload toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowFileUpload(!showFileUpload)}
            className="absolute right-2 top-2 w-8 h-8 p-0"
            disabled={disabled || isLoading}
          >
            <Plus className={`w-4 h-4 transition-transform ${showFileUpload ? 'rotate-45' : ''}`} />
          </Button>
        </div>

        {/* Voice Input Button */}
        {showVoiceInput && isSupported && (
          <Button
            type="button"
            variant={isListening ? "destructive" : "outline"}
            size="sm"
            onClick={handleVoiceToggle}
            disabled={disabled || isLoading}
            className="w-10 h-10 p-0"
          >
            {isListening ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
        )}

        {/* Send Button */}
        <Button
          type="submit"
          disabled={disabled || isLoading || (!message.trim() && uploadedFiles.length === 0)}
          size="sm"
          className="w-10 h-10 p-0"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>
      
      {isListening && (
        <div className="text-sm text-muted-foreground text-center">
          {language === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
        </div>
      )}
    </div>
  );
}
