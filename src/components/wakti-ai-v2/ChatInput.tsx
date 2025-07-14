import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useTheme } from '@/providers/ThemeProvider';
import { X, Plus, Paperclip, Send, Mic, ImagePlus, Type, Sparkles } from 'lucide-react';
import { useFileUpload } from '@/hooks/use-file-upload';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', attachedFiles?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  showVideoUpload: boolean;
  setShowVideoUpload: (show: boolean) => void;
  videoCategory: string;
  videoTemplate: string;
  onOpenVideoDialog?: () => void;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat,
  onOpenPlusDrawer,
  activeTrigger,
  onTriggerChange,
  showVideoUpload,
  setShowVideoUpload,
  videoCategory,
  videoTemplate,
  onOpenVideoDialog
}: ChatInputProps) {
  const [isComposing, setIsComposing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTheme();
  const { upload } = useFileUpload();

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() || attachedFiles.length > 0) {
      onSendMessage(message, activeTrigger, attachedFiles);
      setMessage('');
      setAttachedFiles([]);
    }
  };

  const handleTriggerChange = (trigger: string) => {
    onTriggerChange(trigger);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const uploadResult = await upload(file);
          return {
            id: Date.now() + Math.random(),
            name: file.name,
            url: uploadResult?.url,
            size: file.size,
            type: file.type
          };
        })
      );

      setAttachedFiles(prev => [...prev, ...uploadedFiles]);
    } catch (error) {
      console.error("File upload error:", error);
    }
  };

  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  return (
    <div className="space-y-3">
      {/* Input area */}
      <div className="flex items-end gap-2">
        {/* Left side buttons */}
        <Button
          onClick={onOpenPlusDrawer}
          variant="ghost"
          size="sm"
          className="h-10 px-3"
          title={language === 'ar' ? 'خيارات إضافية' : 'More Options'}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={language === 'ar' ? 'اكتب رسالة...' : 'Type a message...'}
            rows={1}
            className="resize-none pr-12"
          />
          {/* File Attach Button */}
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="sm"
            className="absolute right-1 bottom-1.5 h-8 w-8"
            title={language === 'ar' ? 'إرفاق ملف' : 'Attach File'}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Right side buttons */}
        <div className="flex items-center gap-1">
          {/* Add Video Button */}
          {onOpenVideoDialog && (
            <Button
              onClick={onOpenVideoDialog}
              variant="outline"
              size="sm"
              className="h-10 px-3"
              title={language === 'ar' ? 'إنشاء فيديو' : 'Create Video'}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || (!message.trim() && attachedFiles.length === 0)}
            className="h-10 px-3"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">{language === 'ar' ? 'إرسال' : 'Send'}</span>
          </Button>
        </div>
      </div>

      {/* Attached Files */}
      {attachedFiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto py-2">
          {attachedFiles.map(file => (
            <div key={file.id} className="relative flex-shrink-0">
              <img
                src={file.url}
                alt={file.name}
                className="h-16 w-16 rounded-md object-cover"
              />
              <Button
                onClick={() => removeAttachedFile(file.id)}
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background hover:bg-secondary"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">{language === 'ar' ? 'إزالة' : 'Remove'}</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger buttons */}
      <div className="flex justify-center gap-2">
        <Button
          variant={activeTrigger === 'text' ? 'default' : 'outline'}
          onClick={() => handleTriggerChange('text')}
          size="sm"
        >
          <Type className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'نص' : 'Text'}
        </Button>
        <Button
          variant={activeTrigger === 'voice' ? 'default' : 'outline'}
          onClick={() => handleTriggerChange('voice')}
          size="sm"
          disabled
        >
          <Mic className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'صوت' : 'Voice'}
        </Button>
        <Button
          variant={activeTrigger === 'vision' ? 'default' : 'outline'}
          onClick={() => handleTriggerChange('vision')}
          size="sm"
          disabled
        >
          <ImagePlus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'رؤية' : 'Vision'}
        </Button>
      </div>
    </div>
  );
}
