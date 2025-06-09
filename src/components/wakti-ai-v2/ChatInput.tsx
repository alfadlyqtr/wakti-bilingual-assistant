
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, Send, Loader2, Trash2, X, Image, FileText } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useFileUpload } from '@/hooks/useFileUpload';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', files?: any[]) => void;
  onClearChat: () => void;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat
}: ChatInputProps) {
  const { language } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice recording hook
  const {
    isRecording,
    isProcessing,
    transcript,
    startRecording,
    stopRecording,
    clearRecording
  } = useVoiceRecording();

  // File upload hook
  const {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles
  } = useFileUpload();

  const handleSend = () => {
    if (message.trim() || uploadedFiles.length > 0) {
      onSendMessage(message, 'text', uploadedFiles.length > 0 ? uploadedFiles : undefined);
      setMessage('');
      clearFiles();
    }
  };

  const handleVoiceMessage = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Handle voice transcription
  React.useEffect(() => {
    if (transcript) {
      setMessage(prev => prev ? `${prev} ${transcript}` : transcript);
      clearRecording();
    }
  }, [transcript, setMessage, clearRecording]);

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      await uploadFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  return (
    <>
      {/* Clear Chat Button */}
      {sessionMessages.length > 0 && (
        <div className="px-6 py-2 border-b border-border/30">
          <div className="max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {language === 'ar' ? 'مسح المحادثة' : 'Clear Chat'}
            </Button>
          </div>
        </div>
      )}

      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 bg-background border rounded-lg px-3 py-2 text-sm"
                >
                  {getFileIcon(file.type)}
                  <span className="truncate max-w-[200px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 p-0"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modern Chat Input Area */}
      <div className="p-4 bg-background border-t">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            {/* Upload Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-muted"
              onClick={handleFileUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </Button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Input Container */}
            <div className="flex-1 relative">
              <div className="flex items-end bg-muted/50 rounded-2xl border border-border/30 overflow-hidden">
                {/* Mic Button (when input is empty) */}
                {!message.trim() && !uploadedFiles.length && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 m-1 rounded-xl hover:bg-background/80 ${
                      isRecording ? 'bg-red-500 text-white hover:bg-red-600' : ''
                    }`}
                    onClick={handleVoiceMessage}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                )}

                {/* Text Input */}
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isRecording
                      ? language === 'ar' ? 'جاري التسجيل...' : 'Recording...'
                      : isProcessing
                      ? language === 'ar' ? 'جاري المعالجة...' : 'Processing...'
                      : language === 'ar' ? 'اكتب رسالتك...' : 'Type a message...'
                  }
                  rows={1}
                  className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-3 px-3 max-h-24 overflow-y-auto"
                  style={{ minHeight: '40px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isRecording || isProcessing}
                />

                {/* Send Button (when there's text or files) */}
                {(message.trim() || uploadedFiles.length > 0) && (
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || isRecording || isProcessing}
                    className="h-8 w-8 m-2 rounded-full p-0"
                    size="icon"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Recording indicator */}
          {isRecording && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
                <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                {language === 'ar' ? 'جاري التسجيل...' : 'Recording...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
