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
    <DragDropUpload onFilesSelected={handleFilesSelected} disabled={isLoading}>
      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-3 bg-muted/30">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">
                {language === 'ar' ? 'الملفات المرفقة:' : 'Attached Files:'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({uploadedFiles.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-3">
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

      {/* Mobile-Optimized Chat Input Area */}
      <div className="p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            {/* Upload Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full hover:bg-muted flex-shrink-0"
                    onClick={handleFileUpload}
                    disabled={isUploading || isLoading}
                    aria-label={language === 'ar' ? 'رفع ملف' : 'Upload file'}
                  >
                    {isUploading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
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

            {/* Input Container */}
            <div className="flex-1 relative">
              <div className="flex items-end bg-muted/50 rounded-2xl border border-border/30 overflow-hidden">
                {/* Mic Button - Always visible */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-10 w-10 m-1 rounded-xl hover:bg-background/80 transition-all duration-300 flex-shrink-0 ${
                          isListening 
                            ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' 
                            : speechSupported 
                              ? 'hover:bg-accent' 
                              : 'opacity-50 cursor-not-allowed'
                        }`}
                        onClick={handleVoiceInput}
                        disabled={!speechSupported || isLoading}
                        aria-label={getMicTooltip()}
                      >
                        {isListening ? (
                          <MicOff className="h-5 w-5" />
                        ) : (
                          <Mic className="h-5 w-5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {getMicTooltip()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Text Input */}
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isListening
                      ? language === 'ar' ? 'جاري الاستماع...' : 'Listening...'
                      : language === 'ar' ? 'اكتب رسالتك أو استخدم الميكروفون...' : 'Type a message or use microphone...'
                  }
                  rows={1}
                  className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-3 px-3 max-h-24 overflow-y-auto text-base"
                  style={{ minHeight: '40px' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isListening || isLoading}
                  aria-label={language === 'ar' ? 'اكتب رسالتك' : 'Type your message'}
                />

                {/* Send Button */}
                {(message.trim() || uploadedFiles.length > 0) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSend}
                          disabled={isLoading || isListening || isUploading}
                          className="h-8 w-8 m-2 rounded-full p-0 flex-shrink-0"
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
                      <TooltipContent>
                        {language === 'ar' ? 'إرسال' : 'Send'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          {isListening && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs animate-pulse">
                <div className="h-2 w-2 bg-white rounded-full animate-ping" />
                {language === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
              </div>
            </div>
          )}

          {speechError && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
                <MicOff className="h-3 w-3" />
                {speechError}
              </div>
            </div>
          )}

          {isUploading && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-full text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                {language === 'ar' ? 'جاري رفع الملفات...' : 'Uploading files...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </DragDropUpload>
  );
}
