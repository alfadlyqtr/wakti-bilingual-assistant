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

  // Handle example prompt selection
  const handleExamplePromptSelect = (prompt: string) => {
    // If there's already text, append with a space, otherwise replace
    if (message.trim()) {
      setMessage(message + ' ' + prompt);
    } else {
      setMessage(prompt);
    }
  };

  // Handler to open Conversations Drawer (💬)
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

  // Placeholder functions for PlusMenu (handled by SimplifiedFileUpload now)
  const triggerCamera = () => {
    console.log('📸 CAMERA: Handled by PlusMenu');
  };

  const triggerUpload = () => {
    console.log('📁 UPLOAD: Handled by PlusMenu');
  };

  // Enhanced send message function with proper context handling
  const handleSend = () => {
    console.log('📤 SEND: Checking conditions');
    console.log('Message:', message.trim().length > 0);
    console.log('Files:', uploadedFiles.length);
    
    if (message.trim() || uploadedFiles.length > 0) {
      // Properly format files with context for the backend
      const enhancedFiles = uploadedFiles.map(file => {
        console.log('🔧 Processing file for send:', {
          name: file.name,
          type: file.type,
          hasImageType: !!file.imageType,
          imageTypeName: file.imageType?.name,
          imageTypeId: file.imageType?.id
        });

        // Create context instruction based on image type
        let context = '';
        if (file.imageType?.id) {
          switch (file.imageType.id) {
            case 'document':
              context = 'This is an ID/Document image. Extract all information including names, dates, expiry dates, and validate if still valid. Compare expiry dates with current date and warn if expired.';
              break;
            case 'business_docs':
              context = 'This is a business document. Analyze content, extract key terms, dates, and important business information.';
              break;
            case 'financial':
              context = 'This is a financial document (bill/receipt). Extract amounts, dates, items, and financial details. Calculate totals and provide breakdown if requested.';
              break;
            case 'screenshots':
              context = 'This is a screenshot. Describe the interface, buttons, text, and functionality shown in the image.';
              break;
            case 'text_image':
              context = 'This image contains text. Extract and transcribe all visible text accurately, including handwriting if present.';
              break;
            case 'academic':
              context = 'This is academic content. Help explain concepts, solve problems, and provide detailed educational guidance.';
              break;
            case 'medical':
              context = 'This is a medical document. Extract medical information, explain results, and provide clear interpretations.';
              break;
            case 'technical':
              context = 'This is a technical diagram/chart. Analyze the data, components, and provide detailed technical explanations.';
              break;
            default:
              context = 'Provide detailed description and analysis of this image.';
          }
        }

        return {
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          url: file.url,
          publicUrl: file.publicUrl,
          optimized: true,
          imageType: file.imageType,
          context: context // This is the key fix - adding context to the file object
        };
      });
      
      console.log('📤 SENDING with enhanced context:', {
        message: message.substring(0, 50) + '...',
        filesCount: enhancedFiles.length,
        fileContexts: enhancedFiles.map(f => ({
          name: f.name,
          imageType: f.imageType?.name,
          contextLength: f.context?.length || 0
        }))
      });
      
      onSendMessage(message, 'text', enhancedFiles.length > 0 ? enhancedFiles : undefined);
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
      {/* Simplified File Upload Component with example prompt handling */}
      <SimplifiedFileUpload
        onFilesUploaded={handleFilesUploaded}
        onUpdateFiles={updateFiles}
        uploadedFiles={uploadedFiles}
        onRemoveFile={removeFile}
        isUploading={isUploading}
        disabled={isLoading}
        onExamplePromptSelect={handleExamplePromptSelect}
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
                onCamera={triggerCamera}
                onUpload={triggerUpload}
                isLoading={isLoading || isUploading}
              />
              
              <button
                onClick={handleOpenConversationsDrawer}
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
                onClick={handleOpenQuickActionsDrawer}
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
                    ${textareaHighlightClass}
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
                      if (canSend) {
                        handleSend();
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
                        onClick={handleSend}
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
