
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/providers/ThemeProvider';
import { Mic, Send, Plus, Paperclip, Trash2, MicOff } from 'lucide-react';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { toast } from 'sonner';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', attachedFiles?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat,
  onOpenPlusDrawer,
  activeTrigger
}: ChatInputProps) {
  const { language } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const {
    isRecording,
    startRecording,
    stopRecording,
    audioBlob,
    isProcessing,
    transcription,
    error: recordingError
  } = useVoiceRecording();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [message]);

  // Handle voice recording results
  useEffect(() => {
    if (transcription && !isProcessing) {
      setMessage(transcription);
    }
  }, [transcription, isProcessing, setMessage]);

  useEffect(() => {
    if (recordingError) {
      toast.error(language === 'ar' ? 'خطأ في التسجيل' : 'Recording error', {
        description: recordingError
      });
    }
  }, [recordingError, language]);

  const handleSend = () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    
    const inputType = transcription ? 'voice' : 'text';
    onSendMessage(message.trim(), inputType, attachedFiles);
    setMessage('');
    setAttachedFiles([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(language === 'ar' ? 'حجم الملف كبير جداً' : 'File too large', {
          description: language === 'ar' ? 'يجب أن يكون حجم الملف أقل من 5 ميغابايت' : 'File size must be less than 5MB'
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const newFile = {
          name: file.name,
          type: file.type,
          size: file.size,
          preview: e.target?.result as string,
          file: file
        };
        
        setAttachedFiles(prev => [...prev, newFile]);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    });

    // Reset file input
    if (event.target) {
      event.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVoiceToggle = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const getModeLabel = () => {
    switch (activeTrigger) {
      case 'search':
        return language === 'ar' ? 'البحث' : 'Search';
      case 'image':
        return language === 'ar' ? 'الصور' : 'Images';
      default:
        return language === 'ar' ? 'المحادثة' : 'Chat';
    }
  };

  const getPlaceholder = () => {
    const baseText = language === 'ar' 
      ? 'اكتب رسالتك هنا...' 
      : 'Type your message here...';
    
    if (activeTrigger === 'search') {
      return language === 'ar' 
        ? 'ابحث عن أي شيء...' 
        : 'Search for anything...';
    } else if (activeTrigger === 'image') {
      return language === 'ar' 
        ? 'صف الصورة التي تريد إنشاءها أو ارفع صورة للتحليل...' 
        : 'Describe the image you want to create or upload an image to analyze...';
    }
    
    return baseText;
  };

  return (
    <div className="w-full space-y-3">
      {/* Mode Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          {getModeLabel()}
        </span>
        {sessionMessages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="text-xs h-6 px-2"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {language === 'ar' ? 'مسح' : 'Clear'}
          </Button>
        )}
      </div>

      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 bg-muted/30 rounded-lg">
          {attachedFiles.map((file, index) => (
            <div key={index} className="relative group">
              {file.type.startsWith('image/') ? (
                <div className="relative">
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-16 h-16 object-cover rounded border"
                  />
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-2 bg-background rounded border group-hover:bg-muted/50 transition-colors">
                  <Paperclip className="w-4 h-4" />
                  <span className="text-xs truncate max-w-20">{file.name}</span>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2">
        {/* Plus Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenPlusDrawer}
          className="flex-shrink-0 h-10 w-10 p-0"
          disabled={isLoading}
        >
          <Plus className="w-4 h-4" />
        </Button>

        {/* Main Input Container */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={getPlaceholder()}
            disabled={isLoading || isProcessing}
            className="min-h-[40px] max-h-[120px] resize-none pr-20 text-sm"
            rows={1}
          />
          
          {/* File Upload Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
            disabled={isLoading || isUploading}
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Voice Recording Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleVoiceToggle}
            className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 ${
              isRecording ? 'text-red-500 animate-pulse' : ''
            }`}
            disabled={isLoading}
          >
            {isProcessing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={isLoading || (!message.trim() && attachedFiles.length === 0) || isProcessing}
          className="flex-shrink-0 h-10 w-10 p-0"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Recording Status */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-600 animate-pulse">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          {language === 'ar' ? 'جاري التسجيل...' : 'Recording...'}
        </div>
      )}

      {/* Processing Status */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
        </div>
      )}
    </div>
  );
}
