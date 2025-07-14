import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useAIQuotaManagement } from '@/hooks/useAIQuotaManagement';
import { useToastHelper } from '@/hooks/use-toast-helper';
import { useFileUpload } from '@/hooks/useFileUpload';
import { AIMessage } from '@/services/WaktiAIV2Service';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: AIMessage[];
  onSendMessage: (message: string, trigger: string, attachedFiles?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
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
}: ChatInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { language } = useTheme();
  const { quota } = useAIQuotaManagement();
  const { showSuccess, showError } = useToastHelper();
  const { uploadFile } = useFileUpload();

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, isExpanded]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() || attachedFiles.length > 0) {
      onSendMessage(message, activeTrigger, attachedFiles);
      setMessage('');
      setAttachedFiles([]);
      setIsExpanded(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    try {
      const uploadedFiles = await Promise.all(
        files.map(async (file) => {
          const uploadResult = await uploadFile(file);
          return uploadResult;
        })
      );

      setAttachedFiles((prevFiles) => [...prevFiles, ...uploadedFiles]);
      showSuccess(language === 'ar' ? 'تم تحميل الملف بنجاح' : 'File uploaded successfully');
    } catch (error: any) {
      console.error("File upload error:", error);
      showError(language === 'ar' ? 'فشل في تحميل الملف' : 'Failed to upload file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveFile = (fileToRemove: any) => {
    setAttachedFiles((prevFiles) => prevFiles.filter((file) => file.url !== fileToRemove.url));
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="flex flex-col">
      {/* Attached Files Preview */}
      {attachedFiles.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {attachedFiles.map((file) => (
              <div key={file.url} className="relative inline-flex items-center">
                <img
                  src={file.url}
                  alt={file.name}
                  className="h-10 w-10 rounded-md object-cover"
                />
                <Button
                  onClick={() => handleRemoveFile(file)}
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 bg-red-500 text-white shadow-md hover:bg-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input Area */}
      <div className="relative rounded-lg border border-input bg-background shadow-sm">
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            language === 'ar'
              ? 'اكتب رسالة...'
              : `Ask me anything... (You have ${quota} messages left)`
          }
          rows={1}
          className="resize-none pr-12 py-2 rounded-lg border-0 focus-visible:ring-0 shadow-none"
        />

        {/* Actions */}
        <div className="absolute inset-y-0 right-0 flex items-center space-x-2 pr-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="ghost"
            size="icon"
            className="hover:bg-accent"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSendMessage}
            variant="ghost"
            size="icon"
            className="hover:bg-accent"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*, video/*, audio/*, application/*, text/*"
        />
      </div>
    </div>
  );
}
