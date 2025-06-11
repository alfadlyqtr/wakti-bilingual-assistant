
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, Send, Loader2, MicOff } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useBrowserSpeechRecognition } from '@/hooks/useBrowserSpeechRecognition';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FilePreview } from './FilePreview';
import { DragDropUpload } from './DragDropUpload';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  
  // Dynamic language setting for speech recognition
  const speechLang = language === 'ar' ? 'ar-SA' : 'en-US';
  
  // Browser speech recognition hook with dynamic language
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: speechSupported,
    startListening,
    stopListening,
    clearTranscript
  } = useBrowserSpeechRecognition({
    language: speechLang,
    continuous: false,
    interimResults: false
  });

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

  const handleVoiceInput = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  // Handle speech recognition transcript
  React.useEffect(() => {
    if (transcript) {
      setMessage(message ? `${message} ${transcript}` : transcript);
      clearTranscript();
    }
  }, [transcript, message, setMessage, clearTranscript]);

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

  const handleFilesSelected = async (files: FileList) => {
    await uploadFiles(files);
  };

  const getMicTooltip = () => {
    if (!speechSupported) {
      return language === 'ar' 
        ? 'التعرف على الصوت غير مدعوم' 
        : 'Speech recognition not supported';
    }
    if (isListening) {
      return language === 'ar' 
        ? 'إيقاف الاستماع' 
        : 'Stop listening';
    }
    return language === 'ar' 
      ? 'اضغط للتحدث' 
      : 'Tap to speak';
  };

  return (
    <div className="w-full bg-background/95 backdrop-blur-sm">
      <DragDropUpload onFilesSelected={handleFilesSelected} disabled={isLoading}>
        
        {/* Uploaded Files Display - Clean and minimal */}
        {uploadedFiles.length > 0 && (
          <div className="px-3 py-2 bg-muted/10 border-b border-border/20">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-xs text-muted-foreground">
                  {language === 'ar' ? 'ملفات:' : 'Files:'}
                </span>
                <span className="text-xs text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded">
                  {uploadedFiles.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <FilePreview
                    key={index}
                    file={file}
                    index={index}
                    onRemove={removeFile}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Input Area - Clean and minimal design */}
        <div className="px-3 py-2.5">
          <div className="max-w-4xl mx-auto">
            
            {/* Single line input container */}
            <div className="flex items-center gap-2 bg-muted/20 rounded-lg border border-border/30 p-1.5">
              
              {/* Upload Button - Minimal */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-md hover:bg-accent/50 flex-shrink-0"
                      onClick={handleFileUpload}
                      disabled={isUploading || isLoading}
                      aria-label={language === 'ar' ? 'رفع ملف' : 'Upload file'}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {language === 'ar' ? 'رفع ملف' : 'Upload file'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Mic Button - Minimal */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 rounded-md flex-shrink-0 ${
                        isListening 
                          ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' 
                          : speechSupported 
                            ? 'hover:bg-accent/50' 
                            : 'opacity-40 cursor-not-allowed'
                      }`}
                      onClick={handleVoiceInput}
                      disabled={!speechSupported || isLoading}
                      aria-label={getMicTooltip()}
                    >
                      {isListening ? (
                        <MicOff className="h-4 w-4" />
                      ) : (
                        <Mic className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {getMicTooltip()}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Text Input - Clean design */}
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isListening
                    ? language === 'ar' ? 'جاري الاستماع...' : 'Listening...'
                    : language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'
                }
                className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-1.5 px-2 min-h-[32px] max-h-20 text-sm placeholder:text-muted-foreground/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isListening || isLoading}
                aria-label={language === 'ar' ? 'اكتب رسالتك' : 'Type your message'}
              />

              {/* Send Button - Only when there's content */}
              {(message.trim() || uploadedFiles.length > 0) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSend}
                        disabled={isLoading || isListening || isUploading}
                        className="h-8 w-8 rounded-md p-0 flex-shrink-0 bg-primary hover:bg-primary/90"
                        size="icon"
                        aria-label={language === 'ar' ? 'إرسال' : 'Send'}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {language === 'ar' ? 'إرسال' : 'Send'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Status Indicators - Minimal */}
            {(isListening || speechError || isUploading) && (
              <div className="mt-2 flex justify-center">
                {isListening && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-600 rounded text-xs">
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                    {language === 'ar' ? 'استماع...' : 'Listening...'}
                  </div>
                )}

                {speechError && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-600 rounded text-xs">
                    <MicOff className="h-3 w-3" />
                    {speechError}
                  </div>
                )}

                {isUploading && (
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 text-blue-600 rounded text-xs">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {language === 'ar' ? 'رفع...' : 'Uploading...'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DragDropUpload>
    </div>
  );
}
