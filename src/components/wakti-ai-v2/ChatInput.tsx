
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { useOptimizedFileUpload } from '@/hooks/useOptimizedFileUpload';
import { FilePreview } from './FilePreview';
import { DragDropUpload } from './DragDropUpload';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';

// Returns border/outline classes per mode for main container & textarea
const modeHighlightStyles = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat': return 'border-blue-400 ring-2 ring-blue-200/70 shadow-blue-200/10';
    case 'search': return 'border-green-400 ring-2 ring-green-200/70 shadow-green-100/10';
    case 'image': return 'border-orange-400 ring-2 ring-orange-200/70 shadow-orange-100/15';
    default: return 'border-primary/40';
  }
};
const textareaHighlight = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat': return 'border-blue-300 shadow-[inset_0_2px_12px_0_rgba(96,165,250,0.10)]';
    case 'search': return 'border-green-300 shadow-[inset_0_2px_12px_0_rgba(74,222,128,0.10)]';
    case 'image': return 'border-orange-300 shadow-[inset_0_2px_12px_0_rgba(251,191,36,0.08)]';
    default: return 'border-primary/20';
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

  // Use optimized file upload hook
  const {
    isUploading,
    uploadedFiles,
    uploadFiles,
    removeFile,
    clearFiles
  } = useOptimizedFileUpload();

  // CRITICAL FIX: Handler to open Conversations Drawer (💬)
  const handleOpenConversationsDrawer = () => {
    console.log('💬 EXTRA BUTTON: Dispatching custom event');
    if (typeof window !== "undefined") {
      const nativeEvent = new CustomEvent("open-wakti-conversations");
      window.dispatchEvent(nativeEvent);
    }
  };
  
  // Handler to open Quick Actions Drawer (⚡)
  const handleOpenQuickActionsDrawer = () => {
    console.log('⚡ QUICK ACTIONS: Opening drawer');
    if (onOpenPlusDrawer) onOpenPlusDrawer();
  };

  // New method: trigger camera input
  const triggerCamera = () => {
    cameraInputRef.current?.click();
  };
  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSend = () => {
    if (message.trim() || uploadedFiles.length > 0) {
      // Convert optimized files to format expected by AI service
      const optimizedFiles = uploadedFiles.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        publicUrl: file.publicUrl,
        optimized: true // Flag to indicate this is an optimized upload
      }));
      
      onSendMessage(message, 'text', optimizedFiles.length > 0 ? optimizedFiles : undefined);
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

  // ---- Camera Photo Upload (FIXED) ----
  const handleCameraChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // Use the same optimized upload system as regular files
      await uploadFiles(files);
    }
    // Clear the input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Layout & Mode highlighting classes
  const containerHighlight = modeHighlightStyles(activeTrigger);
  const textareaHighlightClass = textareaHighlight(activeTrigger);

  return (
    <div className="w-full">
      <DragDropUpload onFilesSelected={handleFilesSelected} disabled={isLoading}>
        {/* Uploaded Files Display - Updated to show optimized files */}
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
                <span className="text-xs text-green-500">⚡ Optimized</span>
              </div>
              <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
                {uploadedFiles.map((file, index) => (
                  <div key={file.id} className="relative">
                    <FilePreview
                      file={file}
                      index={index}
                      onRemove={() => removeFile(file.id)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Input Area - CRITICAL FIX: Improved spacing and padding */}
        <div className="px-3 pb-3">
          <div className="max-w-4xl mx-auto">
            <div
              className={`
                relative group flex flex-col bg-white/40 dark:bg-black/30 border-2
                ${containerHighlight}
                shadow-xl rounded-2xl backdrop-blur-2xl
                p-0 transition-all duration-300
                shadow-[0_8px_24px_0_rgba(60,60,100,0.08),inset_0_1.5px_18px_0_rgba(70,70,150,0.13)]
                border-[2.5px] min-h-[70px] max-w-full
              `}
              style={{ willChange: "box-shadow,border-color" }}
            >
              {/* TOP ROW: [Plus] [💬 Extra] [⚡ Quick Actions] [Mode Badge] */}
              <div className="flex items-center gap-2 px-3 pt-2 pb-0.5 w-full">
                <PlusMenu
                  onCamera={triggerCamera}
                  onUpload={triggerUpload}
                  isLoading={isLoading}
                />
                {/* CRITICAL FIX: Enhanced Extra button with proper event dispatch */}
                <button
                  onClick={handleOpenConversationsDrawer}
                  aria-label={language === "ar" ? "إضافي" : "Extra"}
                  className="h-9 px-3 rounded-2xl flex items-center justify-center gap-2 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 ml-0"
                  disabled={isLoading}
                  type="button"
                  tabIndex={0}
                >
                  <span className="text-lg" role="img" aria-label="Extra">💬</span>
                  <span className="text-xs font-medium text-foreground/80">
                    {language === 'ar' ? 'إضافي' : 'Extra'}
                  </span>
                </button>
                {/* CRITICAL FIX: Enhanced Quick Actions button */}
                <button
                  onClick={handleOpenQuickActionsDrawer}
                  aria-label={language === "ar" ? "إجراءات سريعة" : "Quick Actions"}
                  className="h-9 px-3 rounded-2xl flex items-center justify-center gap-2 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 ml-0"
                  disabled={isLoading}
                  type="button"
                  tabIndex={0}
                >
                  <span className="text-lg" role="img" aria-label="Quick Actions">⚡</span>
                  <span className="text-xs font-medium text-foreground/80">
                    {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
                  </span>
                </button>
                <ActiveModeIndicator activeTrigger={activeTrigger} />
                {/* Hidden file/camera inputs */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraChange}
                  className="hidden"
                />
              </div>
              
              {/* INPUT ROW: Textarea + Send - CRITICAL FIX: Better spacing and height management */}
              <div className="relative flex items-end gap-2 px-3 pb-3 pt-0.5">
                <div className="flex-1 flex items-end">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                    className={`
                      flex-1 border-[2.5px]
                      bg-white/95 dark:bg-black/50
                      ${textareaHighlightClass}
                      shadow-inner shadow-primary/10
                      backdrop-blur-[3px] resize-none
                      focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0
                      py-3 px-4 min-h-[42px] max-h-32 text-base leading-relaxed
                      placeholder:text-foreground/50
                      rounded-xl
                      outline-none transition-all duration-200
                    `}
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
                {(message.trim() || uploadedFiles.length > 0) && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleSend}
                          disabled={isLoading || isUploading}
                          className={`
                            h-11 w-11 rounded-xl p-0 flex-shrink-0 bg-primary/90 hover:bg-primary
                            border-0 shadow-2xl backdrop-blur-md
                            transition-all duration-200 hover:scale-110 hover:shadow-2xl
                            shadow-lg
                          `}
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
          </div>
        </div>
      </DragDropUpload>
    </div>
  );
}
