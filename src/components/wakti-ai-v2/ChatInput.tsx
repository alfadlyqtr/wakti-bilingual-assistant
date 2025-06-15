
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

// Returns border/outline classes per mode
const modeHighlightStyles = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat':
      return 'border-blue-400 shadow-blue-300/25 ring-2 ring-blue-200/70';
    case 'search':
      return 'border-green-400 shadow-green-300/25 ring-2 ring-green-200/70';
    case 'image':
      return 'border-orange-400 shadow-orange-200/25 ring-2 ring-orange-200/70';
    default:
      return 'border-primary/40';
  }
};

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, inputType?: 'text' | 'voice', files?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat,
  onOpenPlusDrawer,
  activeTrigger
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFilesSelected = async (files: FileList) => {
    await uploadFiles(files);
  };

  // ---- Camera Snap and Upload (NEW) ----
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

  const handleSendCameraPhoto = () => {
    if (cameraFile) {
      onSendMessage('', 'text', [cameraFile]);
      setCameraFile(null);
      setCameraPreviewUrl(null);
      setShowCameraPreview(false);
    }
  };

  const handleCancelCamera = () => {
    setCameraFile(null);
    setCameraPreviewUrl(null);
    setShowCameraPreview(false);
  };

  // --- NEW: Reworked Visual Arrangement Below ---

  // Mode border/highlight logic
  const highlightClasses = modeHighlightStyles(activeTrigger);

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

        {/* Main Input Area - Enhanced Liquid Glass, Always Visual, Prominent */}
        <div className="px-4 pb-4">
          <div className="max-w-4xl mx-auto">
            <div
              className={`relative group flex flex-col items-stretch bg-white/30 dark:bg-black/30 border-2 ${highlightClasses} shadow-xl rounded-3xl backdrop-blur-2xl p-0 transition-all duration-300`}
              style={{ minHeight: 92, willChange: 'box-shadow,border-color' }}
            >
              {/* Top Row: Plus Icon, Hidden Inputs */}
              <div className="flex items-start gap-2 px-4 pt-3 pb-1">
                {/* Plus Icon */}
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
              </div>
              {/* Mode Badge - Directly BELOW plus icon, visually separated */}
              <div className="flex flex-row py-1 px-4">
                <ActiveModeIndicator activeTrigger={activeTrigger} />
              </div>
              {/* Input Row: Typing Area + Send Button */}
              <div className="relative flex items-end gap-2 px-4 pb-3 pt-1">
                {/* Expanded Textarea - highlight, more spacious! */}
                <div className="flex-1 flex items-end">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                    className={`flex-1 border-0 bg-white/90 dark:bg-black/40 backdrop-blur-md resize-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0 py-4 px-4 min-h-[52px] max-h-40 text-base placeholder:text-foreground/40 rounded-2xl shadow-inner transition-all duration-200 outline-none`}
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
                          className={`h-12 w-12 rounded-2xl p-0 flex-shrink-0 bg-primary/80 hover:bg-primary border-0 shadow-2xl backdrop-blur-md transition-all duration-200 hover:scale-110 hover:shadow-2xl shadow-lg`}
                          size="icon"
                          aria-label={language === 'ar' ? 'إرسال' : 'Send'}
                        >
                          {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <Send className="h-5 w-5" />
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
