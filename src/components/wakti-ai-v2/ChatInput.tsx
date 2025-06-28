import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, Loader2 } from 'lucide-react';
import { VoiceRecorder } from '@/components/wakti-ai-v2/VoiceRecorder';
import { OptimizedUploadedFile } from '@/hooks/useOptimizedFileUpload';
import { FilePreview } from './FilePreview';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', attachedFiles?: OptimizedUploadedFile[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  uploadedFiles?: OptimizedUploadedFile[];
  onUploadFiles?: (files: FileList) => void;
  onRemoveFile?: (fileId: string) => void;
  isUploading?: boolean;
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
  uploadedFiles = [],
  onUploadFiles,
  onRemoveFile,
  isUploading = false
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = () => {
    if (message.trim() || uploadedFiles.length > 0) {
      onSendMessage(message, 'text', uploadedFiles);
      setMessage('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && onUploadFiles) {
      onUploadFiles(files);
    }
    // Reset the input
    e.target.value = '';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 space-y-3">
      {/* File Upload Area */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
          {uploadedFiles.map((file, index) => (
            <FilePreview
              key={file.id}
              file={file}
              index={index}
              onRemove={() => onRemoveFile?.(file.id)}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Main Input Area */}
      <div className="flex items-end gap-2">
        {/* File Upload Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isUploading}
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Text Input */}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 resize-none rounded-lg border border-border p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={1}
          disabled={isLoading || isUploading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />

        {/* Voice Recorder */}
        <VoiceRecorder
          onRecordingComplete={(blob, duration) => {
            onSendMessage('', 'voice');
          }}
          disabled={isLoading || isUploading}
        />

        {/* Send Button */}
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || (!message.trim() && uploadedFiles.length === 0) || isUploading}
          size="icon"
          className="h-10 w-10 flex-shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
