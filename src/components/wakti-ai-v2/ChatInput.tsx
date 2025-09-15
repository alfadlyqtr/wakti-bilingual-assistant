import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, ChevronDown, Plus, ImagePlus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { SimplifiedFileUpload } from './SimplifiedFileUpload';
import { ImageModeFileUpload } from './ImageModeFileUpload';
import type { UploadedFile } from '@/types/fileUpload';
import { useSimplifiedFileUpload } from '@/hooks/useSimplifiedFileUpload';
import { useMobileKeyboard } from '@/hooks/useMobileKeyboard';

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
  onSendMessage: (message: string, trigger: string, files?: any[], imageMode?: ImageMode, imageQuality?: 'fast' | 'best_fast') => void;
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
  // Button ref and viewport position for Search submode dropdown (Web/YouTube)
  const searchModeBtnRef = useRef<HTMLButtonElement>(null);
  const [searchMenuPos, setSearchMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Button ref and viewport position for Image Mode dropdown
  const imageModeBtnRef = useRef<HTMLButtonElement>(null);
  const [imageMenuPos, setImageMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Search submode: 'web' | 'youtube'
  const [searchSubmode, setSearchSubmode] = useState<'web' | 'youtube'>(() => {
    try {
      const v = localStorage.getItem('wakti_search_submode');
      return (v === 'youtube' || v === 'web') ? (v as 'web' | 'youtube') : 'web';
    } catch { return 'web'; }
  });
  // Local-only UI state: image quality dropdown (visible only in image -> text2image)
  const [imageQuality, setImageQuality] = useState<'fast' | 'best_fast'>('fast');
  // TTS Auto Play toggle (persisted)
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
  const seedFileInputRef = useRef<HTMLInputElement>(null);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref to measure the actual input card height for dynamic spacing
  const inputCardRef = useRef<HTMLDivElement>(null);
  // Ref to the inner card to compute offset from viewport bottom to card top
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Mobile keyboard detection
  const { isKeyboardVisible, keyboardHeight } = useMobileKeyboard();
  

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

  // Removed auto-focus to avoid programmatically opening the mobile keyboard
  // Keyboard should appear only after explicit user interaction with the input
  // useEffect(() => {
  //   if (!isInputCollapsed) {
  //     textareaRef.current?.focus();
  //   }
  // }, [isInputCollapsed]);

  // Initialize TTS Auto Play from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('wakti_tts_autoplay');
      setTtsAutoPlay(v === '1');
    } catch {}
  }, []);

  // Close any dropdown menus on global overlay close to avoid invisible blockers
  useEffect(() => {
    const closer = () => {
      setIsModeMenuOpen(false);
      setSearchMenuPos(null);
      setImageMenuPos(null);
    };
    window.addEventListener('wakti-close-all-overlays', closer as EventListener);
    
    // Close dropdowns when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown]') && !target.closest('[data-dropdown-menu]')) {
        setSearchMenuPos(null);
        setImageMenuPos(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      window.removeEventListener('wakti-close-all-overlays', closer as EventListener);
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Dynamically measure input card height and expose as CSS var --chat-input-height
  useEffect(() => {
    const el = inputCardRef.current;
    if (!el) return;

    const applyHeight = () => {
      const h = el.offsetHeight || 0;
      try {
        document.documentElement.style.setProperty('--chat-input-height', `${h}px`);
        document.body?.style?.setProperty?.('--chat-input-height', `${h}px`);
      } catch {}
      try {
        const ev = new CustomEvent('wakti-chat-input-resized', { detail: { height: h } });
        window.dispatchEvent(ev);
      } catch {}
    };

    // Initial measurement
    applyHeight();

    // Observe size changes
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => {
        applyHeight();
      });
      ro.observe(el);
    } catch {
      // Fallback: window resize
      const onResize = () => applyHeight();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    return () => {
      if (ro) {
        try { ro.disconnect(); } catch {}
      }
    };
  }, [isInputCollapsed, activeTrigger]);

  // Measure distance from card top to viewport bottom and expose as --chat-input-offset
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const applyOffset = () => {
      try {
        const rect = card.getBoundingClientRect();
        const offset = Math.max(0, window.innerHeight - rect.top);
        document.documentElement.style.setProperty('--chat-input-offset', `${offset}px`);
        document.body?.style?.setProperty?.('--chat-input-offset', `${offset}px`);
        window.dispatchEvent(new CustomEvent('wakti-chat-input-offset', { detail: { offset } }));
      } catch {}
    };
    applyOffset();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => applyOffset());
      ro.observe(card);
    } catch {
      const onResize = () => applyOffset();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }
    return () => { try { ro && ro.disconnect(); } catch {} };
  }, [isInputCollapsed, activeTrigger]);
  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem('wakti_tts_autoplay', ttsAutoPlay ? '1' : '0');
    } catch {}
  }, [ttsAutoPlay]);
  // Persist search submode selection
  useEffect(() => {
    try { localStorage.setItem('wakti_search_submode', searchSubmode); } catch {}
  }, [searchSubmode]);
  // Broadcast on change so other components (e.g., drawer) stay in sync
  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('wakti-tts-autoplay-changed', { detail: { value: ttsAutoPlay } }));
    } catch {}
  }, [ttsAutoPlay]);
  // Listen for external changes (from drawer toggle)
  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent<{ value: boolean }>;
      if (typeof custom.detail?.value === 'boolean') {
        setTtsAutoPlay(custom.detail.value);
      }
    };
    window.addEventListener('wakti-tts-autoplay-changed', handler as EventListener);
    return () => window.removeEventListener('wakti-tts-autoplay-changed', handler as EventListener);
  }, []);

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

      // If Search + YouTube submode, prefix with lightweight marker for routing in service
      const maybePrefixed = (finalTrigger === 'search' && searchSubmode === 'youtube')
        ? `yt: ${outgoingMessage}`
        : outgoingMessage;

      await onSendMessage(
        maybePrefixed, 
        finalTrigger, // Use the final trigger (could be auto-switched to vision)
        outgoingFiles,
        activeTrigger === 'image' ? imageMode : undefined, // Only pass imageMode if in image mode
        activeTrigger === 'image' ? imageQuality : undefined // Only pass imageQuality if in image mode
      );
    } else {
      console.log('❌ SEND: No message or files to send');
    }
  };

  // Layout & Mode highlighting classes
  // Default highlights from activeTrigger, but override to YouTube-red when Search submode is YouTube
  const containerHighlight = (() => {
    if (activeTrigger === 'search' && searchSubmode === 'youtube') {
      return 'border-red-400 ring-2 ring-red-200/70 shadow-red-100/10';
    }
    return modeHighlightStyles(activeTrigger);
  })();

  // Send button color by mode
  const sendBtnColors = (() => {
    if (activeTrigger === 'search' && searchSubmode === 'youtube') return 'bg-red-600 hover:bg-red-700 text-white';
    switch (activeTrigger) {
      case 'chat':
        return 'bg-blue-600 hover:bg-blue-700 text-white';
      case 'search':
        return 'bg-green-600 hover:bg-green-700 text-white';
      case 'image':
        return 'bg-orange-500 hover:bg-orange-600 text-white';
      case 'video':
        return 'bg-purple-600 hover:bg-purple-700 text-white';
      case 'vision':
        return 'bg-cyan-600 hover:bg-cyan-700 text-white';
      default:
        return 'bg-primary/90 hover:bg-primary text-primary-foreground';
    }
  })();
  const textareaHighlightClass = (() => {
    if (activeTrigger === 'search' && searchSubmode === 'youtube') {
      return 'border-red-300 shadow-[inset_0_2px_12px_0_rgba(248,113,113,0.10)]';
    }
    return textareaHighlight(activeTrigger);
  })();

  // Determine if textarea should be enabled
  const isTextareaEnabled = activeTrigger !== 'video' || (activeTrigger === 'video' && videoTemplate === 'image2video');
  
  // Determine if send button should be enabled
  const canSend = (message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading && isTextareaEnabled;

  // Get appropriate placeholder text
  const getPlaceholderText = () => {
    if (activeTrigger === 'video' && videoTemplate === 'image2video') {
      return language === 'ar' ? 'اكتب وصف الفيديو المخصص...' : 'Enter your custom video prompt...';
    }
    
    // Image mode: show example hint when message is empty, standard when typing
    if (activeTrigger === 'image' && message.trim() === '') {
      return language === 'ar' ? 'مثال: مقهى دافئ عند غروب الشمس، سينمائي، إضاءة ناعمة' : 'Ex: cozy cafe scene, cinematic, soft light';
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
      const validFiles: UploadedFile[] = [];
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
      {/* File Upload Component - Different component based on mode */}
      {activeTrigger !== 'video' && (
        <>
          {activeTrigger === 'image' ? (
            <ImageModeFileUpload
              onFilesUploaded={handleFilesUploaded}
              onRemoveFile={removeFile}
              uploadedFiles={uploadedFiles}
              isUploading={isUploading}
              disabled={isUploading}
              maxFiles={1}
            />
          ) : (
            <SimplifiedFileUpload
              onFilesUploaded={handleFilesUploaded}
              onUpdateFiles={updateFiles}
              uploadedFiles={uploadedFiles}
              onRemoveFile={removeFile}
              isUploading={isUploading}
              disabled={isUploading}
              onAutoSwitchMode={(mode) => {
                if (onTriggerChange) {
                  onTriggerChange(mode);
                  if (mode === 'vision') {
                    setWasAutoSwitchedToVision(true);
                  }
                }
              }}
            />
          )}
        </>
      )}

      {/* Main Input Area - Edge to edge on mobile, tight spacing, keyboard aware */}
      <div 
        className={`w-full px-0 md:px-4 pb-1 md:pb-4 pt-1 mt-0 transition-all duration-300 ${
          isKeyboardVisible ? 'fixed bottom-0 left-0 right-0 z-50' : ''
        }`} 
        ref={inputCardRef}
        style={{
          paddingBottom: isKeyboardVisible ? keyboardHeight : undefined
        }}
      >
        <div className="w-full px-1 md:px-6">
          <div
            className={`
              relative group flex flex-col bg-white/40 dark:bg-black/30 border-2
              ${containerHighlight}
              shadow-xl rounded-2xl backdrop-blur-2xl ios-reduce-blur
              p-0 transition-all duration-300 overflow-visible
              shadow-[0_8px_24px_0_rgba(60,60,100,0.08),inset_0_1.5px_18px_0_rgba(70,70,150,0.13)]
              border-[2.5px] min-h-[70px] w-full
            `}
            ref={cardRef}
          >
            {/* Collapse toggle positioned above input */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); setIsInputCollapsed(v => !v); }}
                      aria-expanded={!isInputCollapsed}
                      aria-label={language === 'ar' ? (isInputCollapsed ? 'توسيع الإدخال' : 'طي الإدخال') : (isInputCollapsed ? 'Expand input' : 'Collapse input')}
                      className="h-8 w-8 rounded-full flex items-center justify-center bg-white text-sky-600 dark:bg-neutral-900 dark:text-white/90 hover:bg-white active:bg-white transition-all border border-white/80 dark:border-white/10 shadow-lg hover:shadow-xl ring-2 ring-sky-500/60 dark:ring-sky-400/60 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900 hover:scale-[1.03] touch-manipulation"
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
            
            {/* MOBILE: Top row with all buttons - Always visible */}
            <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-white/10 md:hidden">
                {/* Left side: Extra + Tools + Upload */}
                <div className="flex items-center gap-2">
                  <button
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try { window.dispatchEvent(new CustomEvent('wakti-close-all-overlays')); } catch {}
                      console.log('💬 EXTRA BUTTON: Dispatching custom event');
                      if (typeof window !== "undefined") {
                        const nativeEvent = new CustomEvent("open-wakti-conversations");
                        window.dispatchEvent(nativeEvent);
                      }
                    }}
                    aria-label={language === "ar" ? "إضافي" : "Extra"}
                    className="h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 shrink-0 touch-manipulation"
                    disabled={isUploading}
                    type="button"
                  >
                    <span className="text-sm" role="img" aria-label="Extra">💬</span>
                    <span className="text-xs font-medium text-foreground/80">
                      {language === 'ar' ? 'إضافي' : 'Extra'}
                    </span>
                  </button>
                  
                  <button
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try { window.dispatchEvent(new CustomEvent('wakti-close-all-overlays')); } catch {}
                      console.log('⚡ TOOLS: Opening drawer');
                      if (onOpenPlusDrawer) onOpenPlusDrawer();
                    }}
                    aria-label={language === "ar" ? "أدوات" : "Tools"}
                    className="h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 flex-shrink-0 touch-manipulation"
                    disabled={isUploading}
                    type="button"
                  >
                    <span className="text-sm" role="img" aria-label="Tools">⚡</span>
                    <span className="text-xs font-medium text-foreground/80">
                      {language === 'ar' ? 'أدوات' : 'Tools'}
                    </span>
                  </button>

                  {/* Upload button - shown in image modes (Text2Image optional, Image2Image/BG-X required), hidden in Chat/Web/YouTube */}
                  {(activeTrigger === 'image' && (imageMode === 'image2image' || imageMode === 'background-removal')) && (
                    <button
                      type="button"
                      onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); triggerSeedUpload(); }}
                      disabled={isUploading}
                      className="h-8 w-8 rounded-xl bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200 dark:bg-orange-900/60 dark:text-orange-300 dark:border-orange-700/60 transition-colors flex items-center justify-center"
                      aria-label={language === 'ar' ? 'تحميل صورة' : 'Upload'}
                      title={language === 'ar' ? 'تحميل صورة' : 'Upload'}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  )}

                  {activeTrigger === 'chat' && (
                    <div className="flex justify-center">
                      <PlusMenu
                        onCamera={() => console.log('📸 CAMERA: Handled by PlusMenu')}
                        onUpload={() => console.log('📁 UPLOAD: Handled by PlusMenu')}
                        isLoading={isUploading}
                      />
                    </div>
                  )}
                </div>

                {/* Right side: Mode Badge + Speed */}
                <div className="flex items-center gap-2">
                  {/* Mode Badge with dropdowns */}
                  <div className="flex items-center">
                    {activeTrigger === 'search' ? (
                      <div className="relative">
                        <button
                          ref={searchModeBtnRef}
                          data-dropdown
                          onPointerUp={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = searchModeBtnRef.current?.getBoundingClientRect();
                            if (rect) {
                              setSearchMenuPos({
                                top: rect.bottom + 4,
                                left: Math.max(8, rect.left - 20)
                              });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 h-7 rounded-full text-[10px] font-medium leading-none border align-middle ${searchSubmode === 'youtube'
                            ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50'
                            : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50'
                          }`}
                        >
                          <span className="text-[10px]">
                            {searchSubmode === 'youtube' ? 'YouTube' : (language === 'ar' ? 'الويب' : 'Web')}
                          </span>
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                        
                        {/* Search Mode Dropdown */}
                        {searchMenuPos && createPortal(
                          <div
                            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[100px]"
                            style={{
                              top: searchMenuPos.top,
                              left: searchMenuPos.left,
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onPointerUp={() => {
                                setSearchSubmode('web');
                                setSearchMenuPos(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                              {language === 'ar' ? 'الويب' : 'Web'}
                            </button>
                            <button
                              onPointerUp={() => {
                                setSearchSubmode('youtube');
                                setSearchMenuPos(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                              YouTube
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    ) : activeTrigger === 'image' ? (
                      <div className="relative">
                        <button
                          ref={imageModeBtnRef}
                          onPointerUp={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = imageModeBtnRef.current?.getBoundingClientRect();
                            if (rect) {
                              setImageMenuPos({
                                top: rect.bottom + 4,
                                left: Math.max(8, rect.left - 20)
                              });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 h-7 rounded-full text-[10px] font-medium leading-none bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50 align-middle shrink-0"
                        >
                          <ImagePlus className="h-2.5 w-2.5" />
                          <span className="text-[10px]">
                            {imageMode === 'image2image' ? (language === 'ar' ? 'صورة 2' : 'Image 2') 
                             : imageMode === 'background-removal' ? 'BG-X' 
                             : (language === 'ar' ? 'صورة' : 'Image')}
                          </span>
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                        
                        {/* Image Mode Dropdown */}
                        {imageMenuPos && createPortal(
                          <div
                            className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px]"
                            style={{
                              top: imageMenuPos.top,
                              left: imageMenuPos.left,
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onPointerUp={() => {
                                setImageMode('text2image');
                                setImageMenuPos(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {language === 'ar' ? 'نص إلى صورة' : 'Text2Image'}
                            </button>
                            <button
                              onPointerUp={() => {
                                setImageMode('image2image');
                                setImageMenuPos(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {language === 'ar' ? 'صورة إلى صورة' : 'Image2Image'}
                            </button>
                            <button
                              onPointerUp={() => {
                                setImageMode('background-removal');
                                setImageMenuPos(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              {language === 'ar' ? 'إزالة الخلفية' : 'BG Removal'}
                            </button>
                          </div>,
                          document.body
                        )}
                      </div>
                    ) : activeTrigger === 'chat' ? (
                      <div className="inline-flex items-center gap-1 px-2 py-1 h-7 rounded-full text-[10px] font-medium leading-none bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50 align-middle">
                        <span className="text-[10px]">{language === 'ar' ? 'دردشة' : 'Chat'}</span>
                      </div>
                    ) : (
                      <ActiveModeIndicator activeTrigger={activeTrigger} />
                    )}
                  </div>

                  {/* Speed dropdown - only in Text2Image mode */}
                  {activeTrigger === 'image' && imageMode === 'text2image' && (
                    <div className="flex justify-center">
                      <div className="relative inline-flex items-center justify-center bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-800/60 rounded-lg px-2 py-1 shadow-sm min-w-[56px]">
                        <select
                          aria-label={language === 'ar' ? 'اختيار الجودة' : 'Select quality'}
                          className="appearance-none text-[11px] leading-none bg-transparent outline-none text-orange-900 dark:text-orange-200 cursor-pointer text-center"
                          value={imageQuality}
                          onChange={(e) => setImageQuality(e.target.value as 'fast' | 'best_fast')}
                        >
                          <option value="fast">{language === 'ar' ? 'سريع' : 'Fast'}</option>
                          <option value="best_fast">{language === 'ar' ? 'أفضل' : 'Best'}</option>
                        </select>
                        <span className="pointer-events-none absolute right-1 text-orange-900 dark:text-orange-200">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M7 10l5 5 5-5z" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  )}
                 </div>
               </div>

            {/* DYNAMIC Quick Reply Pills - REACTIVE TO DROPDOWN SELECTION */}
            {uploadedFiles.length > 0 && message === '' && !isInputCollapsed && (
              <div className="flex gap-2 flex-wrap px-3 py-2 mb-2 border-b border-white/20">
                {/* Background Removal: show only a single bilingual chip */}
                {activeTrigger === 'image' && imageMode === 'background-removal' ? (
                  <button
                    onClick={() => setMessage(language === 'ar' ? 'أزل الخلفية' : 'Remove the background')}
                    className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                  >
                    🧹 {language === 'ar' ? 'أزل الخلفية' : 'Remove the background'}
                  </button>
                ) : (
                  <>
                    {uploadedFiles[0]?.imageType?.id === 'ids' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'ما المعلومات الموجودة في هذا المستند؟' : 'What info is on this document?')}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm"
                        >
                          🔍 {language === 'ar' ? 'ما المعلومات الموجودة في هذا المستند؟' : 'What info is on this document?'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'استخرج كل النص' : 'Extract all the text for me')}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm"
                        >
                          📝 {language === 'ar' ? 'استخرج كل النص' : 'Extract all the text'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'bills' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'كم أنفقت؟' : 'How much did I spend?')}
                          className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm"
                        >
                          💰 {language === 'ar' ? 'كم أنفقت؟' : 'How much did I spend?'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'قسّم هذه الفاتورة بين ___ أشخاص' : 'Split this bill between ___ people')}
                          className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm"
                        >
                          ➗ {language === 'ar' ? 'قسّم هذه الفاتورة' : 'Split this bill'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'food' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'كم عدد السعرات؟' : 'How many calories is this?')}
                          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                        >
                          🔥 {language === 'ar' ? 'كم عدد السعرات؟' : 'How many calories?'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'ما المكونات التي تراها؟' : 'What ingredients do you see?')}
                          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                        >
                          🥗 {language === 'ar' ? 'ما المكونات؟' : 'What ingredients?'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'docs' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'أجب عن الأسئلة في هذا' : 'Answer the questions in this')}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                        >
                          📚 {language === 'ar' ? 'أجب عن الأسئلة' : 'Answer the questions'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'اشرح هذا المخطط/التقرير' : 'Explain this chart/report')}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                        >
                          📊 {language === 'ar' ? 'اشرح هذا المخطط' : 'Explain this chart'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'screens' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'ما الخطأ/المشكلة هنا؟' : "What's the error/problem here?")}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm"
                        >
                          🚨 {language === 'ar' ? 'ما الخطأ هنا؟' : "What's the error?"}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'كيف أصلح ذلك خطوة بخطوة؟' : 'How do I fix this step by step?')}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm"
                        >
                          🛠️ {language === 'ar' ? 'كيف أصلح ذلك؟' : 'How to fix this?'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'photos' && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'صف الشخص/الأشخاص' : 'Describe the person/people')}
                          className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm"
                        >
                          👥 {language === 'ar' ? 'صف الأشخاص' : 'Describe the people'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'أين تم التقاط هذه الصورة؟' : 'Where was this taken?')}
                          className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm"
                        >
                          📍 {language === 'ar' ? 'أين تم التقاطها؟' : 'Where was this taken?'}
                        </button>
                      </>
                    )}
                    {(!uploadedFiles[0]?.imageType || uploadedFiles[0]?.imageType?.id === 'general') && (
                      <>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'صف كل ما تراه' : 'Describe everything you see')}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm"
                        >
                          👁️ {language === 'ar' ? 'صف كل شيء' : 'Describe everything'}
                        </button>
                        <button
                          onClick={() => setMessage(language === 'ar' ? 'ما الموضوع الرئيسي هنا؟' : "What's the main subject here?")}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm"
                        >
                          🔍 {language === 'ar' ? 'ما الموضوع الرئيسي؟' : "What's the main subject?"}
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
            
            {/* INPUT ROW: Just textarea and send button */}
            {!isInputCollapsed && (
              <div className="relative px-3 pb-3 pt-1">
                {/* Textarea with send button directly next to it */}
                <div className="flex items-end gap-3">
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={getPlaceholderText()}
                    autoExpand={true}
                    maxLines={4}
                    minLines={1}
                    className={`
                      flex-1 border-[2.5px]
                      bg-white/95 dark:bg-gray-800/90
                      text-gray-900 dark:text-gray-100
                      ${textareaHighlightClass}
                      shadow-inner shadow-primary/10
                      backdrop-blur-[3px] resize-none
                      focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0
                      text-base leading-5
                      rounded-xl
                      outline-none transition-all duration-200
                      ${!isTextareaEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                      ${activeTrigger === 'image' && message.trim() === '' 
                        ? 'placeholder:text-sm placeholder:italic placeholder:text-gray-400 dark:placeholder:text-gray-500' 
                        : 'placeholder:text-gray-500 dark:placeholder:text-gray-400'}
                      py-3 px-4
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
                  
                  {/* Send button: always visible, disabled when cannot send */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onPointerUp={(e) => { e.preventDefault(); e.stopPropagation(); handleSendMessage(); }}
                          disabled={!canSend}
                          className={`
                            h-11 w-11 rounded-xl p-0 flex-shrink-0
                            ${sendBtnColors}
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
