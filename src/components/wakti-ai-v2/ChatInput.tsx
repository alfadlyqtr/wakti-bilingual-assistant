import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAudioSession } from '@/hooks/useAudioSession';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, ChevronDown, ChevronLeft, ChevronRight, Plus, ImagePlus, MessageSquare, Search as SearchIcon, Image as ImageIcon, SlidersHorizontal, Wand2, Mic, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/providers/ThemeProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PlusMenu } from './PlusMenu';
import { ActiveModeIndicator } from './ActiveModeIndicator';
import { SimplifiedFileUpload } from './SimplifiedFileUpload';
import { ImageModeFileUpload } from './ImageModeFileUpload';
import { TalkBubble } from './TalkBubble';
import type { UploadedFile } from '@/types/fileUpload';
import { useSimplifiedFileUpload } from '@/hooks/useSimplifiedFileUpload';
// Removed useMobileKeyboard hook - ChatInput now handles its own keyboard detection
import { supabase } from '@/integrations/supabase/client';

// Returns border/outline classes per mode for main container & textarea
const modeHighlightStyles = (activeTrigger: string) => {
  switch (activeTrigger) {
    case 'chat': return 'border-blue-300 ring-2 ring-blue-200/70 shadow-blue-200/10';
    case 'search': return 'border-green-300 ring-2 ring-green-200/70 shadow-green-100/10';
    case 'image': return 'border-orange-300 ring-2 ring-orange-200/70 shadow-orange-100/15';
    case 'video': return 'border-purple-300 ring-2 ring-purple-200/70 shadow-purple-100/15';
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

export type ImageMode = 'text2image' | 'image2image' | 'background-removal' | 'draw-after-bg';

export type ChatSubmode = 'chat' | 'study';

export interface ReplyContext {
  messageId: string;
  content: string;
}

interface ChatInputProps {
  message: string;
  setMessage: (message: string) => void;
  isLoading: boolean;
  sessionMessages: any[];
  onSendMessage: (message: string, trigger: string, files?: any[], imageMode?: ImageMode, imageQuality?: 'fast' | 'best_fast', chatSubmode?: ChatSubmode, replyContext?: ReplyContext) => void;
  onClearChat: () => void;
  onOpenPlusDrawer: () => void;
  onOpenConversations?: () => void;
  activeTrigger: string;
  onTriggerChange?: (trigger: string) => void;
  onImageModeChange?: (mode: ImageMode) => void;
  showVideoUpload?: boolean;
  setShowVideoUpload?: (show: boolean) => void;
  videoCategory?: string;
  videoTemplate?: string;
  chatSubmode?: ChatSubmode;
  onChatSubmodeChange?: (submode: ChatSubmode) => void;
  onAddTalkMessage?: (role: 'user' | 'assistant', text: string) => void;
  replyContext?: ReplyContext | null;
  onClearReply?: () => void;
}

export function ChatInput({
  message,
  setMessage,
  isLoading,
  sessionMessages,
  onSendMessage,
  onClearChat,
  onOpenPlusDrawer,
  onOpenConversations,
  activeTrigger,
  onTriggerChange,
  onImageModeChange,
  showVideoUpload = false,
  setShowVideoUpload,
  videoCategory = 'custom',
  videoTemplate = 'image2video',
  chatSubmode = 'chat',
  onChatSubmodeChange,
  onAddTalkMessage,
  replyContext,
  onClearReply
}: ChatInputProps) {
  const { language } = useTheme();
  const [wasAutoSwitchedToVision, setWasAutoSwitchedToVision] = useState(false);
  const [imageMode, setImageMode] = useState<ImageMode>('text2image');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [showQuickModes, setShowQuickModes] = useState(false);
  const quickModesAnchorRef = useRef<HTMLButtonElement>(null);
  const [quickModesPos, setQuickModesPos] = useState<{ top: number; left: number } | null>(null);
  const [quickModesDirection, setQuickModesDirection] = useState<'up' | 'down'>('down');
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
  // Custom dropdown position for Image quality (Fast/Best)
  const qualityBtnRef = useRef<HTMLButtonElement>(null);
  const [qualityMenuPos, setQualityMenuPos] = useState<{ top: number; left: number } | null>(null);
  // TTS Auto Play toggle (persisted)
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);
  const seedFileInputRef = useRef<HTMLInputElement>(null);
  // Hidden input for Chat mode image upload (+ button in Chat)
  const chatUploadInputRef = useRef<HTMLInputElement>(null);
  const [isInputCollapsed, setIsInputCollapsed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref to measure the actual input card height for dynamic spacing
  const inputCardRef = useRef<HTMLDivElement>(null);
  // Ref to the inner card to compute offset from viewport bottom to card top
  const cardRef = useRef<HTMLDivElement>(null);
  // Image2Image inline translation state
  const [isTranslatingI2I, setIsTranslatingI2I] = useState(false);
  const [isAmping, setIsAmping] = useState(false);
  // Chat/Study submode dropdown state
  const chatSubmodeBtnRef = useRef<HTMLButtonElement>(null);
  const [chatSubmodeMenuPos, setChatSubmodeMenuPos] = useState<{ top: number; left: number } | null>(null);
  // Talk mode state
  const [isTalkOpen, setIsTalkOpen] = useState(false);

  // Compute a safe, clamped viewport position for the QuickModes portal
  const getQuickModesPortalPos = () => {
    const anchor = quickModesAnchorRef.current?.getBoundingClientRect();
    const rawTop = quickModesPos?.top ?? (anchor ? anchor.top : window.innerHeight - 80);
    const rawLeft = quickModesPos?.left ?? (anchor ? (anchor.left + anchor.width / 2) : (window.innerWidth / 2));
    const top = Math.max(12, Math.min(rawTop - 16, window.innerHeight - 12));
    const left = Math.max(12, Math.min(rawLeft, window.innerWidth - 12));
    return { top, left };
  };

  // Modes Stepper (Option B)
  const [showModesStepper, setShowModesStepper] = useState(false);
  const [stepperIndex, setStepperIndex] = useState(0); // 0: chat, 1: search, 2: image
  const modesOrder: Array<{ key: 'chat' | 'search' | 'image'; labelEn: string; labelAr: string; color: string }> = [
    { key: 'chat', labelEn: 'Chat', labelAr: 'دردشة', color: 'bg-blue-600' },
    { key: 'search', labelEn: 'Search', labelAr: 'بحث', color: 'bg-green-600' },
    { key: 'image', labelEn: 'Image', labelAr: 'صورة', color: 'bg-orange-500' },
  ];
  const currentMode = modesOrder[stepperIndex];

  // Always default Image mode to Text2Image + Fast when the user ENTERS Image mode.
  // Important: only run on transition into Image mode, so it doesn't override submode changes while already in Image.
  const prevTriggerRef = useRef<string>(activeTrigger);
  useEffect(() => {
    const prev = prevTriggerRef.current;
    prevTriggerRef.current = activeTrigger;
    if (activeTrigger === 'image' && prev !== 'image') {
      setImageMode('text2image');
      setImageQuality('fast');
      onImageModeChange?.('text2image');
    }
  }, [activeTrigger, onImageModeChange]);
  const attachDebugOverlay = () => {
    try {
      const id = 'wakti-modes-debug-overlay';
      if (document.getElementById(id)) return;
      const el = document.createElement('div');
      el.id = id;
      el.setAttribute('data-wakti-debug', '1');
      el.style.position = 'fixed';
      el.style.inset = '0';
      el.style.background = 'rgba(255,0,0,0.08)';
      el.style.zIndex = '2147483647';
      el.style.pointerEvents = 'none';
      el.innerHTML = '<div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border:2px dashed #f00;padding:8px 12px;border-radius:12px;font-weight:700;font-family:sans-serif;color:#c00;">Modes Stepper DEBUG</div>';
      document.body.appendChild(el);
    } catch {}
  };
  const removeDebugOverlay = () => {
    try {
      const el = document.getElementById('wakti-modes-debug-overlay');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch {}
  };
  const openModesStepper = () => {
    // Initialize index based on current activeTrigger
    const idx = Math.max(0, modesOrder.findIndex(m => m.key === (activeTrigger as any)));
    setStepperIndex(idx === -1 ? 0 : idx);
    setShowQuickModes(false);
    setShowModesStepper(true);
  };
  const closeModesStepper = () => { setShowModesStepper(false); };
  const cycleLeft = () => setStepperIndex((i) => (i + modesOrder.length - 1) % modesOrder.length);
  const cycleRight = () => setStepperIndex((i) => (i + 1) % modesOrder.length);
  // Position stepper just above textarea center
  const getStepperPos = () => {
    const rect = textareaRef.current?.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const topRaw = rect ? rect.top : (window.innerHeight - 200);
    const top = Math.max(12, Math.min(topRaw - 16, window.innerHeight - 12));
    const left = Math.max(12, Math.min(cx, window.innerWidth - 12));
    return { top, left };
  };
  
  // Self-contained mobile keyboard detection - scoped to container only
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const isKeyboardMode = (typeof window !== 'undefined' && window.innerWidth < 768) && isKeyboardVisible;
  
  // Get parent container for scoping changes
  const containerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = inputCardRef.current;
    if (el) {
      containerRef.current = el.closest('.wakti-ai-container') as HTMLElement;
    }
  }, []);

  // Recompute Quick Modes anchor position when opened/resized/scrolled
  useEffect(() => {
    if (!showQuickModes) return;
    const updatePos = () => {
      // Prefer anchoring to the chat messages area so the popup overlaps bubbles
      const host = document.querySelector('.wakti-ai-messages-area') as HTMLElement | null;
      if (host) {
        const r = host.getBoundingClientRect();
        setQuickModesPos({ top: r.bottom - 12, left: r.left + r.width / 2 });
        return;
      }
      // Fallback to button rect
      const el = quickModesAnchorRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setQuickModesPos({ top: rect.top, left: rect.left });
      }
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showQuickModes]);
  
  // Handle keyboard detection - scope changes to container only
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKeyboardDetection = () => {
      const vv = window.visualViewport;
      const vvH = vv?.height ?? window.innerHeight;
      const threshold = 150;
      const viewportShrank = window.innerHeight - vvH > threshold;
      
      const ae = document.activeElement as HTMLElement | null;
      const isEditableActive = !!ae && (
        ae.tagName === 'INPUT' ||
        ae.tagName === 'TEXTAREA' ||
        ae.getAttribute('contenteditable') === 'true'
      );
      
      const visible = isEditableActive && viewportShrank;
      setIsKeyboardVisible(visible);
      
      // Apply class to closest parent container only, NOT document.body
      const container = containerRef.current;
      if (container) {
        if (visible) {
          container.classList.add('keyboard-visible');
        } else {
          container.classList.remove('keyboard-visible');
        }
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.getAttribute('contenteditable') === 'true')) {
        setTimeout(handleKeyboardDetection, 150);
      }
    };
    
    const handleFocusOut = () => {
      setTimeout(handleKeyboardDetection, 150);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleKeyboardDetection);
    } else {
      window.addEventListener('resize', handleKeyboardDetection);
    }
    
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleKeyboardDetection);
      } else {
        window.removeEventListener('resize', handleKeyboardDetection);
      }
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      
      // Clean up keyboard-visible class from container when component unmounts
      if (containerRef.current) {
        containerRef.current.classList.remove('keyboard-visible');
      }
    };
  }, []);
  
  // Ensure input row is always visible when keyboard is open
  useEffect(() => {
    if (isKeyboardMode) {
      try { setIsInputCollapsed(false); } catch {}
    }
  }, [isKeyboardMode]);


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
    const hasAnyImage = Array.isArray(uploadedFiles) && uploadedFiles.some((f: any) => {
      const t = (f?.type || '') as string;
      const url = (f?.url || '') as string;
      const isImageType = t.startsWith('image/');
      const isImageUrl = typeof url === 'string' && (url.startsWith('http') || url.startsWith('data:'));
      return isImageType || isImageUrl;
    });
    if (wasAutoSwitchedToVision && activeTrigger === 'vision' && !hasAnyImage) {
      console.log('🔄 AUTO-RESET: No images present, switching back to chat mode');
      if (onTriggerChange) {
        onTriggerChange('chat');
      }
      setWasAutoSwitchedToVision(false);
    }
  }, [uploadedFiles, activeTrigger, wasAutoSwitchedToVision, onTriggerChange]);

  // When in Image mode and switching to Text2Image, clear any seed uploads from other submodes
  useEffect(() => {
    if (activeTrigger === 'image' && imageMode === 'text2image' && uploadedFiles.length > 0) {
      try {
        console.log('🧹 Clearing seed uploads: switched to Text2Image');
        clearFiles();
      } catch {}
    }
  }, [activeTrigger, imageMode]);

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
      setShowQuickModes(false);
    };
    window.addEventListener('wakti-close-all-overlays', closer as EventListener);
    
    // Close dropdowns when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('[data-dropdown]') &&
        !target.closest('[data-dropdown-menu]') &&
        !target.closest('[data-quickmodes]') &&
        !target.closest('[data-quickmodes-menu]') &&
        !target.closest('[data-stepper-menu]')
      ) {
        setSearchMenuPos(null);
        setImageMenuPos(null);
        setShowQuickModes(false);
        // Do not forcibly close the stepper here; it has its own backdrop closer
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('pointerdown', handleClickOutside);
    
    return () => {
      window.removeEventListener('wakti-close-all-overlays', closer as EventListener);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, []);

  // Dynamically measure input card height and expose as CSS var --chat-input-height
  useEffect(() => {
    const el = inputCardRef.current;
    if (!el) return;
    // Don't use CSS variables anymore - emit events only
    const applyHeight = () => {
      const h = el.offsetHeight || 0;
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
      // No CSS variables to clean up - just emit final event
      try {
        window.dispatchEvent(new CustomEvent('wakti-chat-input-resized', { detail: { height: 0 } }));
      } catch {}
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
    return () => {
      try { ro && ro.disconnect(); } catch {}
      // No CSS variables to clean up - just emit final event
      try {
        window.dispatchEvent(new CustomEvent('wakti-chat-input-offset', { detail: { offset: 0 } }));
      } catch {}
    };
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

  // Listen for auto-submit events from quick action buttons
  useEffect(() => {
    const handleAutoSubmit = () => {
      // Trigger send if there's content and we're not loading
      if (message.trim().length > 0 && !isLoading) {
        handleSendMessage();
      }
    };
    window.addEventListener('wakti-auto-submit', handleAutoSubmit);
    return () => window.removeEventListener('wakti-auto-submit', handleAutoSubmit);
  }, [message, isLoading]);

  const handleSendMessage = async () => {
    if ((message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading) {
      console.log('📤 SEND: Message being sent', { message: message.substring(0, 50), filesCount: uploadedFiles.length });
      
      // Use the current activeTrigger - no auto-switching for image mode
      let finalTrigger = activeTrigger;
      
      // AUTO-SWITCH TO VISION MODE ONLY if not already in image mode
      // BUT: Do NOT switch if we're in Study mode - Study handles images for tutoring
      if (uploadedFiles.length > 0 && activeTrigger !== 'image') {
        const hasImages = uploadedFiles.some(file => file.type?.startsWith('image/'));
        const isStudyMode = activeTrigger === 'chat' && chatSubmode === 'study';
        if (hasImages && activeTrigger !== 'video' && activeTrigger !== 'vision' && !isStudyMode) {
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
      // Include raw base64 as `data` and `content` for backend VisionSystem (Claude/OpenAI)
      const enhancedFiles = uploadedFiles.length > 0 ? uploadedFiles.map(file => {
        const dataUrl = file.base64 || file.url || '';
        const commaIdx = typeof dataUrl === 'string' ? dataUrl.indexOf(',') : -1;
        const rawB64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          url: file.url,
          preview: file.preview,
          imageType: file.imageType || { id: 'general', name: 'General' },
          data: rawB64,
          content: rawB64
        };
      }) : undefined;

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
        activeTrigger === 'image' && imageMode === 'text2image' ? imageQuality : undefined, // Only pass imageQuality for Text2Image
        activeTrigger === 'chat' ? chatSubmode : undefined, // Pass chatSubmode for Chat mode (chat vs study)
        replyContext || undefined // Pass reply context if replying to a message
      );
      
      // Clear reply context after sending
      if (replyContext && onClearReply) {
        onClearReply();
      }
    } else {
      console.log('❌ SEND: No message or files to send');
    }
  };
  // Helper to check if file is an image (handles iOS empty MIME types)
  const isImageFile = (file: File): boolean => {
    if (file.type.startsWith('image/')) return true;
    // iOS often returns empty type for HEIC/photos - check extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg'].includes(ext);
  };

  // Chat mode: handle simple image uploads from '+' button
  const handleChatUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const MAX_VISION_IMAGES = 4;
      const existingCount = Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
      const remainingSlots = Math.max(0, MAX_VISION_IMAGES - existingCount);
      if (remainingSlots <= 0) {
        console.warn('❌ ChatInput: max vision images reached:', MAX_VISION_IMAGES);
        e.target.value = '';
        return;
      }
      const validFiles: UploadedFile[] = [];
      const maxToProcess = Math.min(files.length, remainingSlots);
      for (let i = 0; i < maxToProcess; i++) {
        const file = files[i];
        console.log('📁 ChatInput processing:', file.name, 'type:', file.type, 'size:', file.size);
        if (!isImageFile(file)) {
          console.warn('❌ ChatInput rejected - not image:', file.name, file.type);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          console.warn('❌ ChatInput rejected - too large:', file.name, file.size);
          continue;
        }
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
          console.error('Chat image conversion failed:', err);
        }
      }
      if (validFiles.length > 0) {
        handleFilesUploaded(validFiles);
        // Auto-switch to Vision to reflect image context when in Chat (but NOT in Study mode)
        // Study mode keeps images for tutoring without switching to Vision
        if (activeTrigger === 'chat' && chatSubmode !== 'study' && onTriggerChange) {
          onTriggerChange('vision');
          setWasAutoSwitchedToVision(true);
        }
      }
    }
    // reset input so same file can be chosen again
    e.target.value = '';
  };

  // Layout & Mode highlighting classes
  // Default highlights from activeTrigger, but override for YouTube-red or Study-purple
  const containerHighlight = (() => {
    if (activeTrigger === 'search' && searchSubmode === 'youtube') {
      return 'border-red-300 ring-2 ring-red-200/70 shadow-red-100/10';
    }
    if (activeTrigger === 'chat' && chatSubmode === 'study') {
      return 'border-purple-300 ring-2 ring-purple-200/70 shadow-purple-100/15';
    }
    return modeHighlightStyles(activeTrigger);
  })();

  // Send button color by mode
  const sendBtnColors = (() => {
    if (activeTrigger === 'search' && searchSubmode === 'youtube') return 'bg-red-600 hover:bg-red-700 text-white';
    if (activeTrigger === 'chat' && chatSubmode === 'study') return 'bg-purple-500 hover:bg-purple-600 text-white';
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
    if (activeTrigger === 'chat' && chatSubmode === 'study') {
      return 'border-purple-300 shadow-[inset_0_2px_12px_0_rgba(147,51,234,0.10)]';
    }
    return textareaHighlight(activeTrigger);
  })();

  // While processing (translating or amping), highlight the textarea content
  const processingHighlightClass = isTranslatingI2I
    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 animate-pulse'
    : (isAmping ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-400 animate-pulse' : '');

  // Determine if textarea should be enabled
  const isTextareaEnabled = activeTrigger !== 'video' || (activeTrigger === 'video' && videoTemplate === 'image2video');
  
  // Determine if send button should be enabled
  const hasArabic = (s: string) => /[\u0600-\u06FF]/.test(s || '');
  const isArabicI2I = activeTrigger === 'image' && imageMode === 'image2image' && hasArabic(message);
  // In draw-after-bg mode, prompt is required for generation
  const canSend = (message.trim().length > 0 || uploadedFiles.length > 0) && !isLoading && !isUploading && isTextareaEnabled && !isArabicI2I;

  // Get appropriate placeholder text
  const getPlaceholderText = () => {
    if (activeTrigger === 'video' && videoTemplate === 'image2video') {
      return language === 'ar' ? 'اكتب وصف الفيديو المخصص...' : 'Enter your custom video prompt...';
    }
    // Search mode helpers
    if (activeTrigger === 'search' && message.trim() === '') {
      if (searchSubmode === 'youtube') {
        return language === 'ar' ? 'ابحث على يوتيوب: عنوان، موضوع، أو قناة' : 'search youtube,  song title + artist  or vedio title';
      }
      return language === 'ar' ? 'ابحث في الويب: موضوع أو سؤال' : 'search the web !! News, sport reaults, topics and more.';
    }
    // Image mode: adapt helper example to the selected imageMode when empty
    if (activeTrigger === 'image' && message.trim() === '') {
      return getImageModeExample();
    }
    return language === 'ar' ? 'اكتب رسالتك...' : 'Type your message...';
  };

  // Dynamic helper example per imageMode (shown only in Image mode)
  const getImageModeExample = () => {
    if (language === 'ar') {
      switch (imageMode) {
        case 'text2image':
          return 'مثال: مقهى دافئ، سينمائي، إضاءة ناعمة';
        case 'image2image':
          return 'مثال: حوّل الصورة إلى أسلوب ألوان مائية';
        case 'background-removal':
          return 'مثال: إزالة الخلفية والإبقاء على العنصر فقط';
        default:
          return '';
      }
    } else {
      switch (imageMode) {
        case 'text2image':
          return 'Ex: cozy cafe, cinematic, soft light';
        case 'image2image':
          return 'Ex: style the uploaded image as watercolor';
        case 'background-removal':
          return 'Ex: remove background, keep subject only';
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
        // Validate image type and size (5MB limit) - use helper for iOS compatibility
        if (!isImageFile(file)) continue;
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
    <>
    <div className="w-full space-y-4">
      {/* File Upload Component - Different component based on mode (hidden during mobile keyboard) */}
      {!isKeyboardMode && activeTrigger !== 'video' && (
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
              isStudyMode={activeTrigger === 'chat' && chatSubmode === 'study'}
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
        className="w-full px-0 md:px-4 pb-0 md:pb-0 pt-1 mt-0"
        ref={inputCardRef}
      >  
        <div className="w-full px-0 md:px-6">
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
            {/* Collapse toggle positioned above input (hidden when keyboard is visible) */}
            {!isKeyboardMode && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 hide-on-keyboard">
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
            )}
            
            {/* Top row with all buttons - always visible (even during mobile keyboard) */}
            <div className="flex items-center justify-between px-3 pt-2 pb-0 isolate relative z-[200] pointer-events-auto">
                {/* Left side: Extra + Modes + Quick Modes + Mode Badge (moved here) */}
                <div className="flex items-center gap-2" >
                  <button
                    onPointerUp={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try { window.dispatchEvent(new CustomEvent('wakti-close-all-overlays')); } catch {}
                      if (onOpenConversations) {
                        console.log('💬 EXTRA BUTTON: Opening conversations via prop');
                        onOpenConversations();
                      } else {
                        console.log('💬 EXTRA BUTTON: No onOpenConversations prop provided');
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
                  
                  <div className="relative z-[100000]" data-quickmodes>
                    <button
                      ref={quickModesAnchorRef}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Ensure no outside closers run before our click
                        // @ts-ignore
                        if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                          // @ts-ignore
                          e.nativeEvent.stopImmediatePropagation();
                        }
                        try { window.dispatchEvent(new CustomEvent('wakti-close-all-overlays')); } catch {}
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔘 Modes button: toggle Quick Modes mini panel');
                        setShowModesStepper(false);
                        try {
                          const rect = quickModesAnchorRef.current?.getBoundingClientRect();
                          const estimatedHeight = 130; // approx height of the mini panel
                          const spaceBelow = Math.max(0, window.innerHeight - (rect?.bottom ?? 0));
                          const spaceAbove = Math.max(0, (rect?.top ?? 0));
                          // Prefer down if there is enough space, otherwise up
                          const dir = (spaceBelow >= estimatedHeight || spaceBelow > spaceAbove) ? 'down' : 'up';
                          setQuickModesDirection(dir);
                        } catch {}
                        setShowQuickModes(v => !v);
                      }}
                      aria-expanded={showQuickModes}
                      aria-label={language === "ar" ? "أوضاع" : "Modes"}
                      className="h-8 px-3 rounded-xl flex items-center justify-center gap-1.5 bg-white/10 dark:bg-white/5 hover:bg-white/20 active:bg-white/30 transition-all border-0 flex-shrink-0 touch-manipulation text-foreground/80 dark:text-white/85"
                      disabled={false}
                      type="button"
                    >
                      <SlidersHorizontal className="h-4 w-4" />
                      <span className="text-xs font-medium text-foreground/80">{language === 'ar' ? 'أوضاع' : 'Modes'}</span>
                    </button>
                    {/* Quick Modes mini panel directly below the button (legacy desktop dropdown) */}
                    <AnimatePresence>
                      {showQuickModes && (
                        <motion.div
                          key="quick-modes-inline"
                          initial={{ opacity: 0, y: -8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                          className={`hidden`}
                          data-quickmodes-menu
                          style={{ maxWidth: 'min(92vw, 560px)' }}
                        >
                          <div className="pointer-events-auto rounded-2xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/95 to-white/85 dark:from-neutral-900/90 dark:to-neutral-900/70 backdrop-blur-2xl shadow-[0_18px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 p-2 pr-3 flex flex-col gap-2">
                            <motion.button
                              initial={{ opacity: 0, y: -10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ delay: 0.00, type: 'spring', stiffness: 380, damping: 24 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('chat'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] hover:shadow-[0_12px_30px_rgba(37,99,235,0.45)] active:scale-[0.98]"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="text-xs font-semibold">{language === 'ar' ? 'دردشة' : 'Chat'}</span>
                            </motion.button>
                            <motion.button
                              initial={{ opacity: 0, y: -10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ delay: 0.06, type: 'spring', stiffness: 380, damping: 24 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('search'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-green-600 text-white shadow-[0_10px_24px_rgba(22,163,74,0.35)] hover:shadow-[0_12px_30px_rgba(22,163,74,0.45)] active:scale-[0.98]"
                            >
                              <SearchIcon className="h-4 w-4" />
                              <span className="text-xs font-semibold">{language === 'ar' ? 'بحث' : 'Search'}</span>
                            </motion.button>
                            <motion.button
                              initial={{ opacity: 0, y: -10, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ delay: 0.12, type: 'spring', stiffness: 380, damping: 24 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('image'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 bg-orange-500 text-white shadow-[0_10px_24px_rgba(234,88,12,0.35)] hover:shadow-[0_12px_30px_rgba(234,88,12,0.45)] active:scale-[0.98]"
                            >
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-xs font-semibold">{language === 'ar' ? 'صورة' : 'Image'}</span>
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {/* Modes Stepper (Option B) via portal - full-screen overlay to guarantee visibility */}
                    <AnimatePresence>
                      {showModesStepper && createPortal(
                        <motion.div
                          key="modes-stepper"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.12 }}
                          className="fixed inset-0 z-[2147483647] flex items-center justify-center"
                          style={{ zIndex: 2147483647, opacity: 1 }}
                          data-stepper-menu
                        >
                          {/* click-away area with faint backdrop to confirm visibility */}
                          <button
                            aria-label="Close stepper"
                            onPointerDown={(e) => { e.stopPropagation(); closeModesStepper(); }}
                            className="absolute inset-0 bg-black/10 pointer-events-auto"
                            style={{ cursor: 'default' }}
                          />
                          {/* stepper bubble centered in viewport to avoid clipping */}
                          <div
                            className="pointer-events-auto flex items-center gap-2 px-2 py-1.5 rounded-2xl border border-red-400 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.25)]"
                            style={{ maxWidth: 'min(92vw, 560px)' }}
                          >
                            <button
                              aria-label="Prev mode"
                              onPointerUp={(e) => { e.stopPropagation(); cycleLeft(); }}
                              className="h-8 w-8 rounded-full bg-white/70 dark:bg-neutral-800/60 border border-white/60 dark:border-white/10 flex items-center justify-center hover:bg-white active:scale-[0.98]"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <motion.button
                              key={currentMode.key}
                              onPointerUp={() => { onTriggerChange && onTriggerChange(currentMode.key); closeModesStepper(); }}
                              className={`px-4 py-2 rounded-xl text-white font-semibold ${currentMode.color} shadow-[0_10px_24px_rgba(0,0,0,0.25)] active:scale-[0.98]`}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                            >
                              {language === 'ar' ? currentMode.labelAr : currentMode.labelEn}
                            </motion.button>
                            <button
                              aria-label="Next mode"
                              onPointerUp={(e) => { e.stopPropagation(); cycleRight(); }}
                              className="h-8 w-8 rounded-full bg-white/70 dark:bg-neutral-800/60 border border-white/60 dark:border-white/10 flex items-center justify-center hover:bg-white active:scale-[0.98]"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>,
                        document.body
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right side: Mode Badge + Upload button + Speed */}
                <div className="flex items-center gap-2 relative z-[80] pointer-events-auto">
                  {/* Mode Badge with dropdowns */}
                  <div className="flex items-center relative z-[81] pointer-events-auto">
                    {activeTrigger === 'search' ? (
                      <div className="relative">
                        <button
                          ref={searchModeBtnRef}
                          data-dropdown
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Hard stop native bubbling to our document click listener
                            // @ts-ignore
                            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation();
                            const rect = searchModeBtnRef.current?.getBoundingClientRect();
                            if (searchMenuPos) {
                              setSearchMenuPos(null);
                            } else if (rect) {
                              const margin = 8; // gap above badge
                              const rightEdge = Math.min(window.innerWidth - 12, rect.right);
                              setSearchMenuPos({ top: rect.top - margin, left: rightEdge - 8 });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 h-8 rounded-full text-xs font-medium leading-none border align-middle ${
                            searchSubmode === 'youtube'
                              ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/50'
                              : 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${searchSubmode === 'youtube' ? 'bg-red-500' : 'bg-green-500'}`}></span>
                          <span className="text-xs">
                            {searchSubmode === 'youtube' ? 'YouTube' : (language === 'ar' ? 'الويب' : 'Web')}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {createPortal(
                          <AnimatePresence>
                            {searchMenuPos && (
                              <motion.div
                                key="search-menu"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                                className="fixed z-[9999] min-w-[140px]"
                                data-dropdown-menu
                                style={{ top: searchMenuPos.top, left: searchMenuPos.left, transform: 'translate(-100%, -100%)', transformOrigin: 'bottom right' }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/90 to-white/70 dark:from-neutral-900/80 dark:to-neutral-900/60 backdrop-blur-3xl shadow-[0_18px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 py-1">
                                  <button onPointerUp={() => { setSearchSubmode('web'); setSearchMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"><span className="w-3 h-3 bg-green-500 rounded-full"></span>{language === 'ar' ? 'الويب' : 'Web'}</button>
                                  <button onPointerUp={() => { setSearchSubmode('youtube'); setSearchMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"><span className="w-3 h-3 bg-red-500 rounded-full"></span>YouTube</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          document.body
                        )}
                      </div>
                    ) : activeTrigger === 'image' ? (
                      <div className="relative flex items-center gap-2">
                        <button
                          ref={imageModeBtnRef}
                          data-dropdown
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // @ts-ignore
                            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation();
                            const rect = imageModeBtnRef.current?.getBoundingClientRect();
                            if (imageMenuPos) {
                              setImageMenuPos(null);
                            } else if (rect) {
                              const margin = 8;
                              // Prefer clamping within the chat/messages area so the menu visually aligns with the chat column
                              const host = document.querySelector('.wakti-ai-messages-area') as HTMLElement | null;
                              const bounds = host ? host.getBoundingClientRect() : null;
                              const minX = (bounds?.left ?? 12) + 12;
                              const maxX = (bounds ? bounds.right - 12 : window.innerWidth - 12);
                              const centerX = rect.left + rect.width / 2;
                              const clampedX = Math.max(minX, Math.min(centerX, maxX));
                              setImageMenuPos({ top: rect.top - margin, left: clampedX });
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1 h-8 rounded-full text-xs font-medium leading-none bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/50 align-middle shrink-0"
                        >
                          <ImagePlus className="h-3 w-3" />
                          <span className="text-xs">
                            {imageMode === 'image2image'
                              ? (language === 'ar' ? 'صورة إلى صورة' : 'Image2Image')
                              : imageMode === 'background-removal'
                                ? (language === 'ar' ? 'إزالة الخلفية' : 'BG Removal')
                                 : imageMode === 'draw-after-bg'
                                  ? (language === 'ar' ? 'رسم' : 'Draw')
                                  : (language === 'ar' ? 'نص إلى صورة' : 'Text2Image')}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        {createPortal(
                          <AnimatePresence>
                            {imageMenuPos && (
                              <motion.div
                                key="image-menu"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                                className="fixed z-[9999] min-w-[160px]"
                                data-dropdown-menu
                                style={{
                                  top: imageMenuPos.top,
                                  left: imageMenuPos.left,
                                  transform: 'translate(-50%, -100%)',
                                  transformOrigin: 'bottom center',
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/90 to-white/70 dark:from-neutral-900/80 dark:to-neutral-900/60 backdrop-blur-3xl shadow-[0_18px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 py-1">
                                  <button onPointerUp={() => { setImageMode('text2image'); onImageModeChange?.('text2image'); setImageMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'نص إلى صورة' : 'Text2Image'}</button>
                                  <button onPointerUp={() => { setImageMode('image2image'); onImageModeChange?.('image2image'); setImageMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'صورة إلى صورة' : 'Image2Image'}</button>
                                  <button onPointerUp={() => { setImageMode('background-removal'); onImageModeChange?.('background-removal'); setImageMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'إزالة الخلفية' : 'BG Removal'}</button>
                                  <button onPointerUp={() => { setImageMode('draw-after-bg'); onImageModeChange?.('draw-after-bg'); setImageMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'رسم' : 'Draw'}</button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          document.body
                        )}

                        {/* Seed image upload for Image Mode submodes that require an input image (excluding draw-after-bg) */}
                        {imageMode !== 'text2image' && imageMode !== 'draw-after-bg' && (
                          <button
                            type="button"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-800/60 text-orange-900 dark:text-orange-200 shadow-sm"
                            onClick={(e) => { e.stopPropagation(); seedFileInputRef.current?.click(); }}
                            aria-label={language === 'ar' ? 'رفع صورة مرجعية' : 'Upload reference image'}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}

                        {imageMode === 'text2image' && (
                          <>
                            <button
                              ref={qualityBtnRef}
                              data-dropdown
                              onPointerDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // @ts-ignore
                                if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation();
                                const rect = qualityBtnRef.current?.getBoundingClientRect();
                                if (qualityMenuPos) {
                                  setQualityMenuPos(null);
                                } else if (rect) {
                                  const margin = 8;
                                  const rightEdge = Math.min(window.innerWidth - 12, rect.right);
                                  setQualityMenuPos({ top: rect.top - margin, left: rightEdge - 8 });
                                }
                              }}
                              aria-label={language === 'ar' ? 'اختيار الجودة' : 'Select quality'}
                              className="inline-flex items-center gap-1 px-3 py-1 h-8 rounded-lg text-xs font-medium leading-none bg-orange-50 dark:bg-orange-950/40 border border-orange-200/70 dark:border-orange-800/60 text-orange-900 dark:text-orange-200 shadow-sm"
                            >
                              <span>{imageQuality === 'fast' ? (language === 'ar' ? 'سريع' : 'Fast') : (language === 'ar' ? 'أفضل' : 'Best')}</span>
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            {createPortal(
                              <AnimatePresence>
                                {qualityMenuPos && (
                                  <motion.div
                                    key="quality-menu"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                                    className="fixed z-[9999] min-w-[160px]"
                                    data-dropdown-menu
                                    style={{ top: qualityMenuPos.top, left: qualityMenuPos.left, transform: 'translate(-100%, -100%)', transformOrigin: 'bottom right' }}
                                    onPointerDown={(e) => e.stopPropagation()}
                                  >
                                    <div className="rounded-xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/90 to-white/70 dark:from-neutral-900/80 dark:to-neutral-900/60 backdrop-blur-3xl shadow-[0_18px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 py-1">
                                      <button onPointerUp={() => { setImageQuality('fast'); setQualityMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'سريع' : 'Fast'}</button>
                                      <button onPointerUp={() => { setImageQuality('best_fast'); setQualityMenuPos(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5">{language === 'ar' ? 'أفضل' : 'Best'}</button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>,
                              document.body
                            )}
                          </>
                        )}
                      </div>
                    ) : (activeTrigger === 'chat' || activeTrigger === 'vision') ? (
                      <div className="relative flex items-center gap-2">
                        {/* Chat/Study Submode Dropdown */}
                        {activeTrigger === 'chat' && (
                        <button
                          ref={chatSubmodeBtnRef}
                          data-dropdown
                          onPointerUp={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // @ts-ignore
                            if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation();
                            const rect = chatSubmodeBtnRef.current?.getBoundingClientRect();
                            if (chatSubmodeMenuPos) {
                              setChatSubmodeMenuPos(null);
                            } else if (rect) {
                              const margin = 8;
                              const rightEdge = Math.min(window.innerWidth - 12, rect.right);
                              setChatSubmodeMenuPos({ top: rect.top - margin, left: rightEdge - 8 });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 h-8 rounded-full text-xs font-medium leading-none border align-middle ${
                            chatSubmode === 'study'
                              ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/50'
                              : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/50'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${chatSubmode === 'study' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                          <span className="text-xs">
                            {chatSubmode === 'study' 
                              ? (language === 'ar' ? 'دراسة' : 'Study') 
                              : (language === 'ar' ? 'دردشة' : 'Chat')}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </button>
                        )}
                        {createPortal(
                          <AnimatePresence>
                            {chatSubmodeMenuPos && (
                              <motion.div
                                key="chat-submode-menu"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                                className="fixed z-[9999] min-w-[140px]"
                                data-dropdown-menu
                                style={{ top: chatSubmodeMenuPos.top, left: chatSubmodeMenuPos.left, transform: 'translate(-100%, -100%)', transformOrigin: 'bottom right' }}
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-gradient-to-b from-white/90 to-white/70 dark:from-neutral-900/80 dark:to-neutral-900/60 backdrop-blur-3xl shadow-[0_18px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 py-1">
                                  <button 
                                    onPointerUp={() => { 
                                      onChatSubmodeChange?.('chat'); 
                                      setChatSubmodeMenuPos(null); 
                                    }} 
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                                    {language === 'ar' ? 'دردشة' : 'Chat'}
                                  </button>
                                  <button 
                                    onPointerUp={() => { 
                                      onChatSubmodeChange?.('study'); 
                                      setChatSubmodeMenuPos(null); 
                                    }} 
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                                    {language === 'ar' ? 'دراسة' : 'Study'}
                                    <span className="text-[10px] text-purple-500 ml-1">📚</span>
                                  </button>
                                  <button 
                                    onPointerUp={() => {
                                      setChatSubmodeMenuPos(null);
                                      setIsTalkOpen(true);
                                    }} 
                                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                                  >
                                    <Mic className="h-3 w-3 text-pink-600" />
                                    {language === 'ar' ? 'تحدث' : 'Talk'}
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>,
                          document.body
                        )}
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center h-8 w-8 rounded-lg shadow-sm ${
                            activeTrigger === 'chat' && chatSubmode === 'study'
                              ? 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/60 text-purple-900 dark:text-purple-200'
                              : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 text-blue-900 dark:text-blue-200'
                          }`}
                          onClick={(e) => { e.stopPropagation(); chatUploadInputRef.current?.click(); }}
                          aria-label={language === 'ar' ? 'تحميل صورة' : 'Upload image'}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
               </div>

            {/* DYNAMIC Quick Reply Pills - REACTIVE TO DROPDOWN SELECTION (hidden during mobile keyboard) */}
            {/* STUDY MODE: Show Study-specific chips instead of Vision chips */}
            {!isKeyboardMode && uploadedFiles.length > 0 && message === '' && !isInputCollapsed && activeTrigger === 'chat' && chatSubmode === 'study' && (
              <div className="flex gap-2 flex-wrap px-3 py-2 mb-2 border-b border-purple-200/30 hide-on-keyboard">
                <button
                  onClick={() => setMessage('Explain this step by step')}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                >
                  📚 {language === 'ar' ? 'اشرح خطوة بخطوة' : 'Explain step by step'}
                </button>
                <button
                  onClick={() => setMessage('Solve this and teach me how')}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                >
                  🧠 {language === 'ar' ? 'حل وعلمني' : 'Solve and teach me'}
                </button>
                <button
                  onClick={() => setMessage('What are the key concepts here?')}
                  className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                >
                  💡 {language === 'ar' ? 'ما المفاهيم الرئيسية؟' : 'Key concepts?'}
                </button>
              </div>
            )}
            {/* VISION/IMAGE MODE: Show Vision-specific chips (NOT in Study mode) */}
            {!isKeyboardMode && uploadedFiles.length > 0 && message === '' && !isInputCollapsed && !(activeTrigger === 'chat' && chatSubmode === 'study') && (
              <div className="flex gap-2 flex-wrap px-3 py-2 mb-2 border-b border-white/20 hide-on-keyboard">
                {/* Background Removal: show only a single bilingual chip */}
                {activeTrigger === 'image' && imageMode === 'background-removal' ? (
                  <button
                    onClick={() => setMessage('Remove the background')}
                    className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                  >
                    🧹 {language === 'ar' ? 'أزل الخلفية' : 'Remove the background'}
                  </button>
                ) : activeTrigger === 'image' && imageMode === 'image2image' ? (
                  <>
                    <button
                      onClick={() => setMessage('Convert to watercolor style')}
                      className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                    >
                      🎨 {language === 'ar' ? 'ألوان مائية' : 'Watercolor'}
                    </button>
                    <button
                      onClick={() => setMessage('Make it cartoon/anime')}
                      className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                    >
                      📺 {language === 'ar' ? 'كرتون/أنمي' : 'Cartoon/Anime'}
                    </button>
                    <button
                      onClick={() => setMessage('Enhance sharpness and details')}
                      className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm"
                    >
                      ✨ {language === 'ar' ? 'تحسين التفاصيل' : 'Enhance details'}
                    </button>
                    <button
                      onClick={() => setMessage('Change to black and white')}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm"
                    >
                      🖤 {language === 'ar' ? 'أبيض وأسود' : 'Black & White'}
                    </button>
                    <button
                      onClick={() => setMessage('Increase brightness slightly')}
                      className="px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-full text-sm"
                    >
                      ☀️ {language === 'ar' ? 'زيادة السطوع' : 'Increase brightness'}
                    </button>
                  </>
                ) : (
                  <>
                    {uploadedFiles[0]?.imageType?.id === 'ids' && (
                      <>
                        <button
                          onClick={() => setMessage('What info is on this document?')}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm"
                        >
                          🔍 {language === 'ar' ? 'ما المعلومات الموجودة في هذا المستند؟' : 'What info is on this document?'}
                        </button>
                        <button
                          onClick={() => setMessage('Extract all the text for me')}
                          className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full text-sm"
                        >
                          📝 {language === 'ar' ? 'استخرج كل النص' : 'Extract all the text'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'bills' && (
                      <>
                        <button
                          onClick={() => setMessage('How much did I spend?')}
                          className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm"
                        >
                          💰 {language === 'ar' ? 'كم أنفقت؟' : 'How much did I spend?'}
                        </button>
                        <button
                          onClick={() => setMessage('Split this bill between ___ people')}
                          className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded-full text-sm"
                        >
                          ➗ {language === 'ar' ? 'قسّم هذه الفاتورة' : 'Split this bill'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'food' && (
                      <>
                        <button
                          onClick={() => setMessage('How many calories is this?')}
                          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                        >
                          🔥 {language === 'ar' ? 'كم عدد السعرات؟' : 'How many calories?'}
                        </button>
                        <button
                          onClick={() => setMessage('What ingredients do you see?')}
                          className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-full text-sm"
                        >
                          🥗 {language === 'ar' ? 'ما المكونات؟' : 'What ingredients?'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'docs' && (
                      <>
                        <button
                          onClick={() => setMessage('Answer the questions in this')}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                        >
                          📚 {language === 'ar' ? 'أجب عن الأسئلة' : 'Answer the questions'}
                        </button>
                        <button
                          onClick={() => setMessage('Explain this chart/report')}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-full text-sm"
                        >
                          📊 {language === 'ar' ? 'اشرح هذا المخطط' : 'Explain this chart'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'screens' && (
                      <>
                        <button
                          onClick={() => setMessage("What's the error/problem here?")}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm"
                        >
                          🚨 {language === 'ar' ? 'ما الخطأ هنا؟' : "What's the error?"}
                        </button>
                        <button
                          onClick={() => setMessage('How do I fix this step by step?')}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-full text-sm"
                        >
                          🛠️ {language === 'ar' ? 'كيف أصلح ذلك؟' : 'How to fix this?'}
                        </button>
                      </>
                    )}
                    {uploadedFiles[0]?.imageType?.id === 'photos' && (
                      <>
                        <button
                          onClick={() => setMessage('Describe the person/people')}
                          className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm"
                        >
                          👥 {language === 'ar' ? 'صف الأشخاص' : 'Describe the people'}
                        </button>
                        <button
                          onClick={() => setMessage('Where was this taken?')}
                          className="px-3 py-1.5 bg-pink-100 hover:bg-pink-200 text-pink-800 rounded-full text-sm"
                        >
                          📍 {language === 'ar' ? 'أين تم التقاطها؟' : 'Where was this taken?'}
                        </button>
                      </>
                    )}
                    {(!uploadedFiles[0]?.imageType || uploadedFiles[0]?.imageType?.id === 'general') && (
                      <>
                        <button
                          onClick={() => setMessage('Describe everything you see')}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full text-sm"
                        >
                          👁️ {language === 'ar' ? 'صف كل شيء' : 'Describe everything'}
                        </button>
                        <button
                          onClick={() => setMessage("What's the main subject here?")}
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
                {/* Reply Context Bar (WhatsApp-style) */}
                <AnimatePresence>
                  {replyContext && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-l-4 border-primary rounded-r-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-primary font-medium mb-0.5">
                            {language === 'ar' ? '(قال وقطي)' : '(wakti said)'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {(() => {
                              const firstLine = replyContext.content.split('\n')[0].trim();
                              return firstLine.length > 100 
                                ? firstLine.substring(0, 100) + '...' 
                                : firstLine;
                            })()}
                          </p>
                        </div>
                        <button
                          onClick={onClearReply}
                          className="p-1 hover:bg-background/80 rounded-md transition-colors flex-shrink-0"
                          title={language === 'ar' ? 'إلغاء الرد' : 'Cancel reply'}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Textarea with send button directly next to it */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 relative">
                    <Textarea
                      value={message}
                      onChange={(e) => { setMessage(e.target.value); if (showQuickModes) setShowQuickModes(false); }}
                      placeholder={getPlaceholderText()}
                      autoExpand={true}
                      maxLines={4}
                      minLines={(message.trim() === '' && (activeTrigger === 'image' || activeTrigger === 'search')) ? 2 : 1}
                      className={`wakti-ai-textarea
                        flex-1 border-[2.5px]
                        bg-white/95 dark:bg-gray-800/90
                        text-gray-900 dark:text-gray-100
                        ${textareaHighlightClass}
                        ${processingHighlightClass}
                        shadow-inner shadow-primary/10
                        backdrop-blur-[3px] resize-none
                        focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0
                        text-base leading-5
                        rounded-xl
                        outline-none transition-all duration-200
                        ${!isTextareaEnabled ? 'opacity-50 cursor-not-allowed' : ''}
                        ${(message.trim() === '' && (activeTrigger === 'image' || activeTrigger === 'search')) 
                          ? 'placeholder:text-xs placeholder:italic placeholder:text-gray-400 dark:placeholder:text-gray-500' 
                          : 'placeholder:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400'}
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
                      onPaste={async (e) => {
                        const items = e.clipboardData?.items;
                        if (!items) return;
                        for (let i = 0; i < items.length; i++) {
                          const item = items[i];
                          if (item.type.startsWith('image/')) {
                            e.preventDefault();
                            const file = item.getAsFile();
                            if (file && file.size <= 5 * 1024 * 1024) {
                              try {
                                const base64DataUrl = await fileToBase64(file);
                                const pastedFile: UploadedFile = {
                                  id: `paste-${Date.now()}`,
                                  name: `pasted-image-${Date.now()}.${file.type.split('/')[1] || 'png'}`,
                                  type: file.type,
                                  size: file.size,
                                  url: base64DataUrl,
                                  preview: base64DataUrl,
                                  base64: base64DataUrl,
                                  imageType: { id: 'user_prompt', name: 'User Prompt' }
                                };
                                handleFilesUploaded([pastedFile]);
                              } catch (err) {
                                console.error('Paste image conversion failed:', err);
                              }
                            }
                            break;
                          }
                        }
                      }}
                      disabled={isUploading || !isTextareaEnabled}
                    />
                    {/* Inline Quick Modes bar inside the textarea area (all breakpoints) */}
                    <AnimatePresence>
                      {showQuickModes && (
                        <motion.div
                          key="quick-modes-inline-mobile"
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 6, scale: 0.98 }}
                          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
                          className="absolute left-3 right-3 top-2 z-[100002]"
                        >
                          <div className="pointer-events-auto rounded-xl border border-white/70 dark:border-white/10 bg-white/95 dark:bg-neutral-900/90 backdrop-blur-xl shadow-[0_10px_28px_rgba(0,0,0,0.12)] ring-1 ring-white/25 dark:ring-white/5 px-2 py-1 flex items-center gap-2 overflow-hidden">
                            <motion.button
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.96 }}
                              transition={{ delay: 0.00, type: 'spring', stiffness: 420, damping: 26 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('chat'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold shadow"
                              type="button"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span>{language === 'ar' ? 'دردشة' : 'Chat'}</span>
                            </motion.button>
                            <motion.button
                              initial={{ opacity: 0, x: -18, scale: 0.94 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -10, scale: 0.96 }}
                              transition={{ delay: 0.08, type: 'spring', stiffness: 420, damping: 26 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('search'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 bg-green-600 text-white text-xs font-semibold shadow -ml-0.5"
                              type="button"
                            >
                              <SearchIcon className="h-4 w-4" />
                              <span>{language === 'ar' ? 'بحث' : 'Search'}</span>
                            </motion.button>
                            <motion.button
                              initial={{ opacity: 0, x: 16, scale: 0.94 }}
                              animate={{ opacity: 1, x: 0, scale: 1 }}
                              exit={{ opacity: 0, x: 10, scale: 0.96 }}
                              transition={{ delay: 0.16, type: 'spring', stiffness: 420, damping: 26 }}
                              onPointerUp={() => { onTriggerChange && onTriggerChange('image'); setShowQuickModes(false); }}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold shadow"
                              type="button"
                            >
                              <ImageIcon className="h-4 w-4" />
                              <span>{language === 'ar' ? 'صورة' : 'Image'}</span>
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {activeTrigger === 'image' && imageMode === 'image2image' && (
                      <div className="mt-1 flex items-center gap-2">
                        {language === 'ar' && (
                          <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 leading-tight">
                            {hasArabic(message)
                              ? 'ترجم طلبك →'
                              : 'ملاحظة: العربية غير مدعومة هنا؛ سنرسل النص بالإنجليزية.'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Send button: always visible, disabled when cannot send */}
                  <div className="relative inline-flex flex-col items-end gap-1">
                    {/* Small Translate button placed above the send button (only for Arabic in Image2Image) */}
                    {activeTrigger === 'image' && imageMode === 'image2image' && language === 'ar' && hasArabic(message) && (
                      <button
                        type="button"
                        className={`h-6 px-2 rounded-full text-[10px] font-semibold text-white shadow-md disabled:opacity-50 disabled:pointer-events-none 
                          ${isTranslatingI2I ? 'bg-blue-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'}`}
                        disabled={isTranslatingI2I}
                        onClick={async () => {
                          if (!message || isTranslatingI2I) return;
                          try {
                            setIsTranslatingI2I(true);
                            const { data, error } = await supabase.functions.invoke('image2image-ar2en', { body: { text: message } });
                            if (!error && data?.text) {
                              setMessage(data.text as string);
                            } else {
                              console.error('Translate failed:', error || data);
                            }
                          } catch (e) {
                            console.error('Translate exception:', e);
                          } finally {
                            setIsTranslatingI2I(false);
                          }
                        }}
                        aria-busy={isTranslatingI2I}
                        aria-live="polite"
                      >
                        {isTranslatingI2I ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>{language === 'ar' ? '...جارٍ الترجمة' : 'Translating...'}</span>
                          </span>
                        ) : (
                          <>{language === 'ar' ? 'ترجمة' : 'Translate'}</>
                        )}
                      </button>
                    )}

                    {/* Amp button for prompt enhancement (image modes, including background-removal) */}
                    {activeTrigger === 'image' && (imageMode === 'text2image' || imageMode === 'image2image' || imageMode === 'background-removal') && message.trim().length > 0 && (
                      <button
                        type="button"
                        className={`
                          h-11 w-11 rounded-xl p-0 flex-shrink-0 text-white inline-flex items-center justify-center
                          border-0 shadow-2xl backdrop-blur-md shadow-lg
                          transition-all duration-200 hover:scale-110 hover:shadow-2xl
                          disabled:opacity-50 disabled:pointer-events-none
                          ${isAmping ? 'bg-orange-500 animate-pulse' : 'bg-orange-500 hover:bg-orange-600'}
                        `}
                        disabled={isAmping || isTranslatingI2I}
                        onClick={async () => {
                          if (!message || isAmping) return;
                          try {
                            setIsAmping(true);
                            const { data, error } = await supabase.functions.invoke('prompt-amp', { body: { text: message, mode: imageMode } });
                            if (!error && data?.text) {
                              setMessage(String(data.text));
                            } else {
                              console.error('Amp failed:', error || data);
                            }
                          } catch (e) {
                            console.error('Amp exception:', e);
                          } finally {
                            setIsAmping(false);
                          }
                        }}
                        aria-busy={isAmping}
                        aria-live="polite"
                        title={language === 'ar' ? 'تحسين' : 'Amp'}
                        aria-label={language === 'ar' ? 'تحسين' : 'Amp'}
                      >
                        <Wand2 className={`h-5 w-5 ${isAmping ? 'animate-spin' : ''}`} />
                      </button>
                    )}

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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    {/* Hidden inputs for uploads */}
    <input
      type="file"
      ref={seedFileInputRef}
      onChange={handleSeedFilesChange}
      accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
      multiple={false}
      hidden
    />
    <input
      type="file"
      ref={chatUploadInputRef}
      onChange={handleChatUploadChange}
      accept="image/*,image/heic,image/heif,.png,.jpg,.jpeg,.gif,.webp,.heic,.heif,.bmp,.tiff"
      multiple
      hidden
    />
    {/* Talk Bubble Overlay - rendered via portal to ensure full-screen */}
    {createPortal(
      <TalkBubble
        isOpen={isTalkOpen}
        onClose={() => setIsTalkOpen(false)}
        onUserMessage={(text) => {
          if (text.trim() && onAddTalkMessage) {
            onAddTalkMessage('user', text);
          }
        }}
        onAssistantMessage={(text) => {
          if (text.trim() && onAddTalkMessage) {
            onAddTalkMessage('assistant', text);
          }
        }}
      />,
      document.body
    )}
    </>
  );
}
