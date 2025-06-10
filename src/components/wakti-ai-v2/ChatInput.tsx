
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, Send, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useBrowserSpeechRecognition } from '@/hooks/useBrowserSpeechRecognition';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FilePreview } from './FilePreview';
import { DragDropUpload } from './DragDropUpload';

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
  
  // Browser speech recognition hook
  const {
    isListening,
    transcript,
    error: speechError,
    isSupported: speechSupported,
    startListening,
    stopListening,
    clearTranscript
  } = useBrowserSpeechRecognition();

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

  return (
    <DragDropUpload onFilesSelected={handleFilesSelected} disabled={isLoading}>
      {/* Uploaded Files Display */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-3 bg-muted/30 border-b">
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
              disabled={isUploading || isLoading}
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
                {!message.trim() && !uploadedFiles.length && speechSupported && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-10 w-10 m-1 rounded-xl hover:bg-background/80 ${
                      isListening ? 'bg-red-500 text-white hover:bg-red-600' : ''
                    }`}
                    onClick={handleVoiceInput}
                    disabled={!speechSupported || isLoading}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                )}

                {/* Text Input */}
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isListening
                      ? language === 'ar' ? 'جاري الاستماع...' : 'Listening...'
                      : !speechSupported
                      ? language === 'ar' ? 'التعرف على الصوت غير مدعوم' : 'Voice input not supported'
                      : language === 'ar' ? 'اكتب رسالتك أو اسحب الملفات...' : 'Type a message or drag files...'
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
                  disabled={isListening || isLoading}
                />

                {/* Send Button (when there's text or files) */}
                {(message.trim() || uploadedFiles.length > 0) && (
                  <Button
                    onClick={handleSend}
                    disabled={isLoading || isListening || isUploading}
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

          {/* Listening indicator */}
          {isListening && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
                <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
                {language === 'ar' ? 'جاري الاستماع...' : 'Listening...'}
              </div>
            </div>
          )}

          {/* Speech error indicator */}
          {speechError && (
            <div className="mt-2 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full text-xs">
                {language === 'ar' ? 'خطأ في التعرف على الصوت' : 'Speech recognition error'}
              </div>
            </div>
          )}

          {/* Upload progress indicator */}
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
