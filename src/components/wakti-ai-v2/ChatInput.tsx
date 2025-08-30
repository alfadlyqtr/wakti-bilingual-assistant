import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, ChevronDown, Plus, ImagePlus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { SimplifiedFileUpload } from './SimplifiedFileUpload';
import type { SimplifiedUploadedFile } from './SimplifiedFileUpload';
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

export type ImageMode = 'text2image' | 'image2image' | 'background-removal';

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, trigger: string, files?: any[], imageMode?: ImageMode) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  activeTrigger: string;
  onTriggerChange?: (trigger: string) => void;
  showVideoUpload?: boolean;
  setShowVideoUpload?: (show: boolean) => void;
  videoCategory?: string;
  videoTemplate?: string;
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
  onTriggerChange,
  showVideoUpload = false,
  setShowVideoUpload,
  videoCategory = 'custom',
  videoTemplate = 'image2video'
}: ChatInputProps) {
  const { language } = useTheme();
  const [wasAutoSwitchedToVision, setWasAutoSwitchedToVision] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>('text2image');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const seedFileInputRef = useRef<HTMLInputElement>(null);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-reset vision mode when no images are present
  useEffect(() => {
    // Only auto-reset if we previously auto-switched to vision mode
    if (wasAutoSwitchedToVision && uploadedFiles.length === 0 && activeTrigger === 'vision') {
      console.log('🔄 AUTO-RESET: No images present, switching back to chat mode');
      if (onTriggerChange) {
        onTriggerChange('chat');
      }
      setWasAutoSwitchedToVision(false);
    }
  }, [uploadedFiles.length, activeTrigger, wasAutoSwitchedToVision, onTriggerChange]);

  // Focus textarea after expanding the input area
  useEffect(() => {
    if (!isInputCollapsed) {
      textareaRef.current?.focus();
    }
  }, [isInputCollapsed]);

  // Enhanced send message function with proper data conversion
  const handleSendMessage = async () => {
    if ((message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading) {
      console.log('📤 SEND: Message being sent', { message: message.substring(0, 50), filesCount: uploadedFiles.length });
      
      // Use the current activeTrigger - no auto-switching for image mode
      let finalTrigger = activeTrigger;
      
      // AUTO-SWITCH TO VISION MODE ONLY if not already in image mode
      if (uploadedFiles.length > 0 && activeTrigger !== 'image') {
        const hasImages = uploadedFiles.some(file => file.type?.startsWith('image/'));
        if (hasImages && activeTrigger !== 'video' && activeTrigger !== 'vision') {
          finalTrigger = 'vision';
          setWasAutoSwitchedToVision(true);
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

      // Clear input immediately for snappier UX, while sending uses captured values
      const outgoingMessage = message;
      const outgoingFiles = enhancedFiles;
      setMessage('');
      clearFiles();

      await onSendMessage(
        outgoingMessage, 
        finalTrigger, // Use the final trigger (could be auto-switched to vision)
        outgoingFiles,
        activeTrigger === 'image' ? imageMode : undefined // Only pass imageMode if in image mode
      );
    } else {
      console.log('❌ SEND: No message or files to send');
    }
  };

  // Layout & Mode highlighting classes
  const containerHighlight = modeHighlightStyles(activeTrigger);
  const textareaHighlightClass = textareaHighlight(activeTrigger);

  // Determine if textarea should be enabled
  const isTextareaEnabled = activeTrigger !== 'video' || (activeTrigger === 'video' && videoTemplate === 'image2video');
  
  // Determine if send button should be enabled
  const canSend = (message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading && isTextareaEnabled;

  // Get appropriate placeholder text
  const getPlaceholderText = () => {
    if (activeTrigger === 'video' && videoTemplate === 'image2video') {
      return language === 'ar' ? 'اكتب وصف الفيديو المخصص...' : 'Enter your custom video prompt...';
    }
    return language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...';
  };

  // Dynamic helper example per imageMode (shown only in Image mode)
  const getImageModeExample = () => {
    if (language === 'ar') {
      switch (imageMode) {
        case 'text2image':
          return 'مثال: مقهى دافئ عند غروب الشمس، سينمائي، بدقة 4K، إضاءة ناعمة';
        case 'image2image':
          return 'مثال: حوّل الصورة المرفوعة إلى أسلوب الألوان المائية بتدرجات باستيل';
        case 'background-removal':
          return 'مثال: إزالة الخلفية مع الحفاظ على العنصر فقط بصيغة PNG شفافة';
        default:
          return '';
      }
    } else {
      switch (imageMode) {
        case 'text2image':
          return 'Example: A cozy cafe scene at golden hour, cinematic, 4k, soft lighting';
        case 'image2image':
          return 'Example: Style the uploaded image as watercolor with pastel tones';
        case 'background-removal':
          return 'Example: Remove the background and keep the subject only with a transparent PNG';
        default:
          return '';
      }
    }
  };

  

  // Seed upload (Image mode): trigger and handle locally (no global event)
  const triggerSeedUpload = () => {
    if (!isLoading && !isUploading) seedFileInputRef.current?.click();
  };
  // Local base64 converter
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
    });
  };
  const handleSeedFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const validFiles: SimplifiedUploadedFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Validate image type and size (5MB limit)
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 5 * 1024 * 1024) continue;
        try {
          const base64DataUrl = await fileToBase64(file);
          validFiles.push({
            id: `${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: base64DataUrl,
            preview: base64DataUrl,
            base64: base64DataUrl,
            imageType: { id: 'general', name: 'General' }
          });
        } catch (err) {
          console.error('Seed image conversion failed:', err);
        }
      }
      if (validFiles.length > 0) {
        // Directly add to local uploadedFiles without auto-switching
        handleFilesUploaded(validFiles);
      }
    }
    // reset input so same file can be chosen again
    e.target.value = '';
  };

  return (
    <div className="w-full space-y-4">
      {/* Simplified File Upload Component - Only show for non-video modes */}
      {activeTrigger !== 'video' && (
        <SimplifiedFileUpload
          onFilesUploaded={handleFilesUploaded}
          onUpdateFiles={updateFiles}
          uploadedFiles={uploadedFiles}
          onRemoveFile={removeFile}
          isUploading={isUploading}
          disabled={isUploading}
          onAutoSwitchMode={(mode) => {
            console.log('🔍 UPLOAD AUTO-SWITCH: Switching to', mode);
            // Do NOT auto-switch if currently in Image mode with background-removal selected
            if (activeTrigger === 'image' && imageMode === 'background-removal') {
              console.log('🛑 Skipping auto-switch: background-removal mode active');
              return;
            }
            if (onTriggerChange) {
              onTriggerChange(mode);
              if (mode === 'vision') {
                setWasAutoSwitchedToVision(true);
              }
            }
          }}
        />
      )}

      {/* Main Input Area */}
      <div className="w-full px-0 pb-3 pt-2 mt-2">
        <div className="w-full px-3">
          <div
            className={`
              relative group flex flex-col bg-white/40 dark:bg-black/30 border-2
              ${modeHighlightStyles(activeTrigger)}
              shadow-xl rounded-2xl backdrop-blur-2xl
              p-0 transition-all duration-300
              shadow-[0_8px_24px_0_rgba(60,60,100,0.08),inset_0_1.5px_18px_0_rgba(70,70,150,0.13)]
              border-[2.5px] min-h-[70px] w-full
            `}
          >
            {/* Centered collapse toggle at top */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIsInputCollapsed(v => !v)}
                      aria-expanded={!isInputCollapsed}
                      aria-label={language === 'ar' ? (isInputCollapsed ? 'توسيع الإدخال' : 'طي الإدخال') : (isInputCollapsed ? 'Expand input' : 'Collapse input')}
                      className="h-8 w-8 rounded-full flex items-center justify-center bg-white text-sky-600 dark:bg-neutral-900 dark:text-white/90 hover:bg-white active:bg-white transition-all border border-white/80 dark:border-white/10 shadow-lg hover:shadow-xl ring-2 ring-sky-500/60 dark:ring-sky-400/60 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 hover:scale-[1.03]"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isInputCollapsed ? 'rotate-180' : ''}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                    {language === 'ar' ? (isInputCollapsed ? 'توسيع الإدخال' : 'طي الإدخال') : (isInputCollapsed ? 'Expand input' : 'Collapse input')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* TOP ROW: [Plus] [💬 Extra] [⚡ Quick Actions] [Mode Badge] */}
            <div className="flex items-center gap-2 px-3 pt-2 pb-0.5 w-full">
              {activeTrigger === 'video' ? (
                <button
                  onClick={() => setShowVideoUpload && setShowVideoUpload(true)}
                  className="h-9 px-2 rounded-2xl flex items-center justify-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white transition-all border-0"
                  disabled={isUploading}
                  type="button"
                  title={language === 'ar' ? 'إضافة فيديو' : 'Add Video'}
                >
                  <span className="text-base">+🎬</span>
                </button>
              ) : activeTrigger === 'image' ? null : (
                <PlusMenu
                  onCamera={() => console.log('📸 CAMERA: Handled by PlusMenu')}
                  onUpload={() => console.log('📁 UPLOAD: Handled by PlusMenu')}
                  isLoading={isUploading || activeTrigger === 'image' || activeTrigger === 'search'}
                />
              )}
              
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
                disabled={isUploading}
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
                disabled={isUploading}
                type="button"
              >
                <span className="text-lg" role="img" aria-label="Quick Actions">⚡</span>
                <span className="text-xs font-medium text-foreground/80">
                  {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
                </span>
              </button>
              
              {activeTrigger !== 'image' ? (
                <ActiveModeIndicator activeTrigger={activeTrigger} />
              ) : (
                <div className="relative">
                  {/* Hidden input for seed upload */}
                  <input
                    ref={seedFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleSeedFilesChange}
                    className="hidden"
                  />

                  {/* Compact Image Mode badge as dropdown with inline + (mobile-sized) */}
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50">
                    <button
                      type="button"
                      onClick={() => setIsModeMenuOpen(v => !v)}
                      disabled={isUploading}
                      className="inline-flex items-center gap-1 outline-none"
                      aria-haspopup="menu"
                      aria-expanded={isModeMenuOpen}
                      aria-label={language === 'ar' ? 'وضع الصورة' : 'Image Mode'}
                    >
                      <ImagePlus className="h-3 w-3" />
                      <span>{language === 'ar' ? 'وضع الصورة' : 'Image Mode'}</span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); triggerSeedUpload(); }}
                      disabled={isUploading}
                      className="ml-1 h-5 w-5 flex items-center justify-center rounded-full bg-orange-200/60 text-orange-700 hover:bg-orange-300/60"
                      aria-label={language === 'ar' ? 'تحميل صورة' : 'Upload image'}
                      title={language === 'ar' ? 'تحميل صورة' : 'Upload image'}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  {isModeMenuOpen && (
                    <div
                      role="menu"
                      className="absolute left-0 mt-2 w-56 rounded-xl border border-orange-200/70 bg-orange-50/95 text-orange-900 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800/60 shadow-2xl overflow-hidden z-20 backdrop-blur-md"
                    >
                      <button
                        role="menuitem"
                        onClick={() => { setImageMode('text2image'); setIsModeMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors
                          ${imageMode === 'text2image'
                            ? 'bg-orange-200/70 text-orange-900 dark:bg-orange-800/60 dark:text-orange-100 font-semibold'
                            : 'hover:bg-orange-100/80 dark:hover:bg-orange-900/40'}
                        `}
                      >
                        {language === 'ar' ? 'نص → صورة' : 'Text to Image'}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setImageMode('image2image'); setIsModeMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors
                          ${imageMode === 'image2image'
                            ? 'bg-orange-200/70 text-orange-900 dark:bg-orange-800/60 dark:text-orange-100 font-semibold'
                            : 'hover:bg-orange-100/80 dark:hover:bg-orange-900/40'}
                        `}
                      >
                        {language === 'ar' ? 'صورة → صورة' : 'Image to Image'}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => { setImageMode('background-removal'); setIsModeMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors
                          ${imageMode === 'background-removal'
                            ? 'bg-orange-200/70 text-orange-900 dark:bg-orange-800/60 dark:text-orange-100 font-semibold'
                            : 'hover:bg-orange-100/80 dark:hover:bg-orange-900/40'}
                        `}
                      >
                        {language === 'ar' ? 'إزالة الخلفية' : 'Background Removal'}
                      </button>
                    </div>
                  )}
                </div>
              )}
              
            </div>

            {/* IMAGE MODE HELPER EXAMPLE */}
            {activeTrigger === 'image' && !isInputCollapsed && (
              <div className="px-3 pt-1 pb-2 text-xs text-foreground/70">
                {getImageModeExample()}
              </div>
            )}

            {/* DYNAMIC Quick Reply Pills - REACTIVE TO DROPDOWN SELECTION */}
            {uploadedFiles.length > 0 && message === '' && !isInputCollapsed && (
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
            {!isInputCollapsed && (
              <div className="relative flex items-end gap-2 px-3 pb-3 pt-0.5">
                <div className="flex-1 flex items-end">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={getPlaceholderText()}
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
                      ${!isTextareaEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    ref={textareaRef}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (canSend) {
                          handleSendMessage();
                        }
                      }
                    }}
                    disabled={isUploading || !isTextareaEnabled}
                  />
                </div>
                
                {/* Send button: always visible, disabled when cannot send */}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
