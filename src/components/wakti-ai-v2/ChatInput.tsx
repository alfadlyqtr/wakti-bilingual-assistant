import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, Send, Loader2, MicOff, Camera } from 'lucide-react';
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
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Camera preview modal state
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(false);

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

  // ---- Camera Snap and Upload (NEW) ----

  // Handle camera file input
  const handleCameraChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      const file = files[0];
      setCameraFile(file);
      setCameraPreviewUrl(URL.createObjectURL(file));
      setShowCameraPreview(true);
    }
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Send snapped photo (from camera)
  const handleSendCameraPhoto = () => {
    if (cameraFile) {
      // Call onSendMessage with an empty message and image file as blob
      onSendMessage('', 'text', [cameraFile]);
      setCameraFile(null);
      setCameraPreviewUrl(null);
      setShowCameraPreview(false);
    }
  };

  // Cancel and cleanup camera modal
  const handleCancelCamera = () => {
    setCameraFile(null);
    setCameraPreviewUrl(null);
    setShowCameraPreview(false);
  };

  return (
    <div className="w-full">
      <DragDropUpload onFilesSelected={handleFilesSelected} disabled={isLoading}>
        {/* Camera Preview Modal */}
        {showCameraPreview && cameraPreviewUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 flex flex-col items-center justify-center">
            <div className="bg-background rounded-2xl p-4 shadow-2xl w-80 flex flex-col items-center gap-4">
              <img
                src={cameraPreviewUrl}
                alt="Camera preview"
                className="w-full h-60 object-contain rounded-xl bg-black/10"
              />
              <div className="flex gap-2 mt-2 w-full">
                <Button
                  className="flex-1"
                  variant="default"
                  onClick={handleSendCameraPhoto}
                  disabled={isLoading}
                >
                  {language === 'ar' ? 'إرسال' : 'Send'}
                </Button>
                <Button
                  className="flex-1"
                  variant="ghost"
                  onClick={handleCancelCamera}
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded Files Display - Liquid Glass Style */}
        {uploadedFiles.length > 0 && (
          <div className="px-4 py-3 mb-3 mx-4 rounded-2xl bg-white/5 dark:bg-black/5 backdrop-blur-xl border border-white/10 dark:border-white/5">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-foreground/70">
                  {language === 'ar' ? 'ملفات:' : 'Files:'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {uploadedFiles.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
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

        {/* Main Input Area - Liquid Glass Container */}
        <div className="px-4 pb-4">
          <div className="max-w-4xl mx-auto">
            
            {/* Liquid Glass Input Container */}
            <div className="relative group">
              {/* Glow Effect */}
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm"></div>
              
              {/* Main Container */}
              <div className="relative flex items-center gap-3 bg-white/10 dark:bg-black/10 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/10 p-2 shadow-2xl">
                
                {/* Upload Button - Liquid Glass Style */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-2xl bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border-0 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg flex-shrink-0"
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
                    <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                      {language === 'ar' ? 'رفع ملف' : 'Upload file'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Hidden file input - Updated to exclude PDF */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Camera Button - Liquid Glass Style */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cameraInputRef.current?.click()}
                        className="h-9 w-9 rounded-2xl bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border-0
                          backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg flex-shrink-0"
                        disabled={isLoading}
                        aria-label={language === 'ar' ? 'التقاط صورة' : 'Take Photo'}
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                      {language === 'ar' ? 'التقاط صورة' : 'Take photo'}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Mic Button - Liquid Glass Style */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-9 w-9 rounded-2xl backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:shadow-lg flex-shrink-0 border-0 ${
                          isListening 
                            ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                            : speechSupported 
                              ? 'bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10' 
                              : 'bg-white/5 opacity-40 cursor-not-allowed'
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
                    <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                      {getMicTooltip()}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Text Input - Glass Style */}
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    isListening
                      ? language === 'ar' ? 'جاري الاستماع...' : 'Listening...'
                      : language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'
                  }
                  className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2 px-3 min-h-[36px] max-h-20 text-sm placeholder:text-foreground/40 rounded-2xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isListening || isLoading}
                  aria-label={language === 'ar' ? 'اكتب رسالتك' : 'Type your message'}
                />

                {/* Send Button - Floating Glass Orb */}
                {(message.trim() || uploadedFiles.length > 0) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSend}
                          disabled={isLoading || isListening || isUploading}
                          className="h-9 w-9 rounded-2xl p-0 flex-shrink-0 bg-primary/80 hover:bg-primary border-0 backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:shadow-xl shadow-lg"
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
                      <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                        {language === 'ar' ? 'إرسال' : 'Send'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            {/* Status Indicators - Glass Style */}
            {(isListening || speechError || isUploading) && (
              <div className="mt-3 flex justify-center">
                {isListening && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 backdrop-blur-xl text-red-500 rounded-2xl border border-red-500/20 text-xs font-medium">
                    <div className="h-1.5 w-1.5 bg-red-500 rounded-full animate-ping" />
                    {language === 'ar' ? 'استماع...' : 'Listening...'}
                  </div>
                )}

                {speechError && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 backdrop-blur-xl text-red-500 rounded-2xl border border-red-500/20 text-xs font-medium">
                    <MicOff className="h-3 w-3" />
                    {speechError}
                  </div>
                )}

                {isUploading && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 backdrop-blur-xl text-blue-500 rounded-2xl border border-blue-500/20 text-xs font-medium">
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
