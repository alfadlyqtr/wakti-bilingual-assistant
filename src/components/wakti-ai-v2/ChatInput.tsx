import React, { useState, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface ChatInputProps {
  onSendMessage: (message: string, attachedFiles: any[]) => Promise<void>;
  isLoading: boolean;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
}

export function ChatInput({ onSendMessage, isLoading, activeTrigger, onTriggerChange }: ChatInputProps) {
  const { language } = useTheme();
  const [message, setMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
  };

  const handleSendMessage = async () => {
    if (!message.trim() && attachedFiles.length === 0) return;
    
    const messageToSend = message.trim();
    const filesToSend = attachedFiles.map(file => ({
      name: file.name,
      url: file.url,
      type: file.type,
      size: file.size,
      thumbnail: file.thumbnail
    }));

    setMessage('');
    setAttachedFiles([]);

    await onSendMessage(messageToSend, filesToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files || files.length === 0) return;

    const newFiles = files.map(file => {
      const url = URL.createObjectURL(file);
      return {
        name: file.name,
        url: url,
        type: file.type,
        size: file.size,
        thumbnail: file.type.startsWith('image/') ? url : null
      };
    });

    setAttachedFiles(prevFiles => [...prevFiles, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset the file input
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachedFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  const handleTriggerChange = (newTrigger: string) => {
    onTriggerChange(newTrigger);
  };

  const handleAttachmentClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="border-t border-border p-4">
      {attachedFiles.length > 0 && (
        <div className="mb-3">
          {attachedFiles.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md mb-1">
              <div className="flex items-center">
                {file.type.startsWith('image/') ? (
                  <img src={file.thumbnail || file.url} alt={file.name} className="w-8 h-8 rounded-md mr-2" />
                ) : (
                  <Paperclip className="w-4 h-4 mr-2" />
                )}
                <span>{file.name}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(index)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="relative flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleAttachmentClick}
          disabled={isLoading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          ref={fileInputRef}
        />
        <Input
          placeholder={
            language === 'ar'
              ? 'اكتب رسالتك...'
              : 'Type your message...'
          }
          value={message}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="rounded-r-none"
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || (!message.trim() && attachedFiles.length === 0)}
          className="rounded-l-none"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
