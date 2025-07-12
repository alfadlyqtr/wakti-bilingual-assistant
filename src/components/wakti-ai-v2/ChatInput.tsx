
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { SimplifiedFileUpload } from './SimplifiedFileUpload';
import { useSimplifiedFileUpload } from '@/hooks/useSimplifiedFileUpload';

// Returns border/outline classes per mode for main container & textarea
const modeHighlightStyles = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat': return 'border-blue-400 ring-2 ring-blue-200/70 shadow-blue-200/10';
    case 'search': return 'border-green-400 ring-2 ring-green-200/70 shadow-green-100/10';
    case 'image': return 'border-orange-400 ring-2 ring-orange-200/70 shadow-orange-100/15';
    case 'video': return 'border-purple-400 ring-2 ring-purple-200/70 shadow-purple-100/15';
    default: return 'border-primary/40';
  }
};
const textareaHighlight = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat': return 'border-blue-300 shadow-[inset_0_2px_12px_0_rgba(96,165,250,0.10)]';
    case 'search': return 'border-green-300 shadow-[inset_0_2px_12px_0_rgba(74,222,128,0.10)]';
    case 'image': return 'border-orange-300 shadow-[inset_0_2px_12px_0_rgba(251,191,36,0.08)]';
    case 'video': return 'border-purple-300 shadow-[inset_0_2px_12px_0_rgba(147,51,234,0.10)]';
    default: return 'border-primary/20';
  }
};

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, trigger: string, files?: any[]) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  onTriggerChange?: (trigger: string) => void;
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
  onTriggerChange
}: ChatInputProps) {
  const { language } = useTheme();

  // Use simplified file upload hook
  const {
    isUploading,
    uploadedFiles,
    handleFilesUploaded,
    updateFiles,
    removeFile,
    clearFiles,
    startUploading
  } = useSimplifiedFileUpload();

  // Enhanced send message function with proper data conversion
  const handleSendMessage = async () => {
    if ((message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading) {
      console.log('📤 SEND: Message being sent', { message: message.substring(0, 50), filesCount: uploadedFiles.length });
      
      // AUTO-SWITCH TO VISION MODE IF IMAGES PRESENT
      let finalTrigger = activeTrigger;
      if (uploadedFiles.length > 0) {
        const hasImages = uploadedFiles.some(file => file.type?.startsWith('image/'));
        if (hasImages && activeTrigger !== 'video') {
          finalTrigger = 'vision';
          console.log('🔍 AUTO-SWITCH: Images detected, switching to vision mode');
          // Update the actual trigger
          if (onTriggerChange) {
            onTriggerChange('vision');
          }
        }
      }

      // PROPERLY CONVERT UPLOADED FILES TO ATTACHED FILES FORMAT
      const enhancedFiles = uploadedFiles.length > 0 ? uploadedFiles.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size,
        url: file.url,
        preview: file.preview,
        imageType: file.imageType || { id: 'general', name: 'General' }
      })) : undefined;

      console.log('📎 ENHANCED FILES:', enhancedFiles);

      await onSendMessage(
        message, 
        finalTrigger, // Use the auto-detected trigger
        enhancedFiles
      );
      setMessage('');
      clearFiles();
    } else {
      console.log('❌ SEND: No message or files to send');
    }
  };

  // Layout & Mode highlighting classes
  const containerHighlight = modeHighlightStyles(activeTrigger);
  const textareaHighlightClass = textareaHighlight(activeTrigger);

  // Determine if send button should be enabled
  const canSend = (message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading;

  return (
    <div className="w-full space-y-4">
      {/* Simplified File Upload Component */}
      <SimplifiedFileUpload
        onFilesUploaded={handleFilesUploaded}
        onUpdateFiles={updateFiles}
        uploadedFiles={uploadedFiles}
        onRemoveFile={removeFile}
        isUploading={isUploading}
        disabled={isLoading}
        onAutoSwitchMode={(mode) => {
          console.log('🔍 UPLOAD AUTO-SWITCH: Switching to', mode);
          if (onTriggerChange) {
            onTriggerChange(mode);
          }
        }}
      />

      {/* Main Input Area */}
      <div className="px-3 pb-3 pt-2">
        <div className="max-w-4xl mx-auto">
          <div
            className={`
              relative group flex flex-col bg-white/40 dark:bg-black/30 border-2
              ${modeHighlightStyles(activeTrigger)}
              shadow-xl rounded-2xl backdrop-blur-2xl
              p-0 transition-all duration-300
              shadow-[0_8px_24px_0_rgba(60,60,100,0.08),inset_0_1.5px_18px_0_rgba(70,70,150,0.13)]
              border-[2.5px] min-h-[70px] max-w-full
            `}
          >
            {/* TOP ROW: [Plus] [💬 Extra] [⚡ Quick Actions] [Mode Badge] */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-0.5 w-full">
              <PlusMenu
                onCamera={() => console.log('📸 CAMERA: Handled by PlusMenu')}
                onUpload={() => console.log('📁 UPLOAD: Handled by PlusMenu')}
                isLoading={isLoading || isUploading}
              />
              
              <button
                onClick={() => {
                  console.log('💬 EXTRA BUTTON: Dispatching custom event');
                  if (typeof window !== "undefined") {
                    const nativeEvent = new CustomEvent("open-wakti-conversations");
                    window.dispatchEvent(nativeEvent);
                  }
                }}
                aria-label={language === "ar" ? "إضافي" : "Extra"}
                className="h-9 px-3 rounded-2xl flex items-center justify-center gap-2 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 ml-0"
                disabled={isLoading || isUploading}
                type="button"
              >
                <span className="text-lg" role="img" aria-label="Extra">💬</span>
                <span className="text-xs font-medium text-foreground/80">
                  {language === 'ar' ? 'إضافي' : 'Extra'}
                </span>
              </button>
              
              <button
                onClick={() => {
                  console.log('⚡ QUICK ACTIONS: Opening drawer');
                  if (onOpenPlusDrawer) onOpenPlusDrawer();
                }}
                aria-label={language === "ar" ? "إجراءات سريعة" : "Quick Actions"}
                className="h-9 px-3 rounded-2xl flex items-center justify-center gap-2 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 ml-0"
                disabled={isLoading || isUploading}
                type="button"
              >
                <span className="text-lg" role="img" aria-label="Quick Actions">⚡</span>
                <span className="text-xs font-medium text-foreground/80">
                  {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
                </span>
              </button>
              
              <ActiveModeIndicator activeTrigger={activeTrigger} />
            </div>

            {/* DYNAMIC Quick Reply Pills - REACTIVE TO DROPDOWN SELECTION */}
            {uploadedFiles.length > 0 && message === '' && (
              <div className="flex gap-2 flex-wrap px-3 py-2 mb-2 border-b border-white/20">
                {uploadedFiles[0]?.imageType?.id === 'ids' && (
                  <>
                    <button onClick={() => setMessage('What info is on this document?')} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm">🔍 What info is on this document?</button>
                    <button onClick={() => setMessage('Extract all the text for me')} className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm">📝 Extract all the text</button>
                  </>
                )}
                {uploadedFiles[0]?.imageType?.id === 'bills' && (
                  <>
                    <button onClick={() => setMessage('How much did I spend?')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm">💰 How much did I spend?</button>
                    <button onClick={() => setMessage('Split this bill between ___ people')} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm">➗ Split this bill</button>
                  </>
                )}
                {uploadedFiles[0]?.imageType?.id === 'food' && (
                  <>
                    <button onClick={() => setMessage('How many calories is this?')} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm">🔥 How many calories?</button>
                    <button onClick={() => setMessage('What ingredients do you see?')} className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm">🥗 What ingredients?</button>
                  </>
                )}
                {uploadedFiles[0]?.imageType?.id === 'docs' && (
                  <>
                    <button onClick={() => setMessage('Answer the questions in this')} className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm">📚 Answer the questions</button>
                    <button onClick={() => setMessage('Explain this chart/report')} className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm">📊 Explain this chart</button>
                  </>
                )}
                {uploadedFiles[0]?.imageType?.id === 'screens' && (
                  <>
                    <button onClick={() => setMessage('What\'s the error/problem here?')} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm">🚨 What's the error?</button>
                    <button onClick={() => setMessage('How do I fix this step by step?')} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm">🛠️ How to fix this?</button>
                  </>
                )}
                {uploadedFiles[0]?.imageType?.id === 'photos' && (
                  <>
                    <button onClick={() => setMessage('Describe the person/people')} className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm">👥 Describe the people</button>
                    <button onClick={() => setMessage('Where was this taken?')} className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm">📍 Where was this taken?</button>
                  </>
                )}
                {(!uploadedFiles[0]?.imageType || uploadedFiles[0]?.imageType?.id === 'general') && (
                  <>
                    <button onClick={() => setMessage('Describe everything you see')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm">👁️ Describe everything</button>
                    <button onClick={() => setMessage('What\'s the main subject here?')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm">🔍 What's the main subject?</button>
                  </>
                )}
              </div>
            )}
            
            {/* INPUT ROW: Textarea + Send */}
            <div className="relative flex items-end gap-2 px-3 pb-3 pt-0.5">
              <div className="flex-1 flex items-end">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...'}
                  className={`
                    flex-1 border-[2.5px]
                    bg-white/95 dark:bg-gray-800/90
                    text-gray-900 dark:text-gray-100
                    ${textareaHighlight(activeTrigger)}
                    shadow-inner shadow-primary/10
                    backdrop-blur-[3px] resize-none
                    focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0
                    py-3 px-4 min-h-[42px] max-h-32 text-base leading-relaxed
                    placeholder:text-gray-500 dark:placeholder:text-gray-400
                    rounded-xl
                    outline-none transition-all duration-200
                  `}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if ((message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading) {
                        handleSendMessage();
                      }
                    }
                  }}
                  disabled={isLoading || isUploading}
                />
              </div>
              
              {/* Send button with proper enabling logic */}
              {canSend && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleSendMessage}
                        disabled={!canSend}
                        className={`
                          h-11 w-11 rounded-xl p-0 flex-shrink-0 bg-primary/90 hover:bg-primary
                          border-0 shadow-2xl backdrop-blur-md
                          transition-all duration-200 hover:scale-110 hover:shadow-2xl
                          shadow-lg
                        `}
                        size="icon"
                      >
                        {isLoading || isUploading ? (
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
    </div>
  );
}
