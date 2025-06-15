
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useFileUpload } from '@/hooks/useFileUpload';
import { FilePreview } from './FilePreview';
import { DragDropUpload } from './DragDropUpload';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', files?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string; // Added here
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat,
  onOpenPlusDrawer,
  activeTrigger // Added here
}: ChatInputProps) {
  const { language } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Camera preview modal state
  const [cameraPreviewUrl, setCameraPreviewUrl] = useState<string | null>(null);
  const [cameraFile, setCameraFile] = useState<File | null>(null);
  const [showCameraPreview, setShowCameraPreview] = useState(false);

  // File upload hook
  const {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles
  } = useFileUpload();

  // ADD: Handler to open Conversations Drawer (left)
  const handleOpenConversationsDrawer = () => {
    if (typeof window !== "undefined") {
      const nativeEvent = new CustomEvent("open-wakti-conversations");
      window.dispatchEvent(nativeEvent);
    }
  };

  // ADD: Handler to invoke onOpenPlusDrawer (for Quick Actions, right)
  const handleOpenQuickActionsDrawer = () => {
    if (onOpenPlusDrawer) onOpenPlusDrawer();
  };

  // New method: trigger camera input
  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };

  // Pass to PlusMenu: onUpload triggers the hidden file input
  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSend = () => {
    if (message.trim() || uploadedFiles.length > 0) {
      onSendMessage(message, 'text', uploadedFiles.length > 0 ? uploadedFiles : undefined);
      setMessage('');
      clearFiles();
    }
  };

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
              <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 opacity-0 group-hover:opacity-100 transition-all duration-500 blur-sm"></div>
              
              {/* Main Container */}
              <div className="relative flex items-center gap-3 bg-white/10 dark:bg-black/10 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/10 p-2 shadow-2xl">
                
                {/* ========== NEW: Plus Dropdown Menu ========== */}
                <PlusMenu
                  onCamera={triggerCamera}
                  onUpload={triggerUpload}
                  onOpenConversations={handleOpenConversationsDrawer}
                  onOpenQuickActions={handleOpenQuickActionsDrawer}
                  isLoading={isLoading}
                />

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Hidden camera input */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraChange}
                  className="hidden"
                />

                {/* Chat Badge / Indicator */}
                <div className="flex items-center justify-center h-9 w-28 flex-shrink-0">
                  <ActiveModeIndicator activeTrigger={activeTrigger} />
                </div>

                {/* Text Input - Glass Style */}
                <div className="relative flex-1 flex items-center">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                    className="flex-1 border-0 bg-transparent resize-none focus-visible:ring-0 focus-visible:ring-offset-0 py-2 px-3 min-h-[36px] max-h-20 text-sm placeholder:text-foreground/40 rounded-2xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    disabled={isLoading}
                    aria-label={language === 'ar' ? 'اكتب رسالتك' : 'Type your message'}
                  />
                </div>

                {/* Send Button - Floating Glass Orb */}
                {(message.trim() || uploadedFiles.length > 0) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSend}
                          disabled={isLoading || isUploading}
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
            {isUploading && (
              <div className="mt-3 flex justify-center">
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
