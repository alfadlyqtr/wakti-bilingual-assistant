import React, { useRef, useEffect, useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ExtraPanel } from './ExtraPanel';
import { useTheme } from '@/providers/ThemeProvider';
import { QuickActionsPanel } from './QuickActionsPanel';
import { AIConversation } from '@/services/WaktiAIV2Service';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ChatDrawersProps {
  showConversations: boolean;
  setShowConversations: (show: boolean) => void;
  showQuickActions: boolean;
  setShowQuickActions: (show: boolean) => void;
  conversations: AIConversation[];
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  fetchConversations: () => void;
  onSendMessage: (message: string, inputType?: 'text' | 'voice') => void;
  activeTrigger: string;
  onTriggerChange: (trigger: string) => void;
  onTextGenerated: (text: string, mode: 'compose' | 'reply', isTextGenerated?: boolean) => void;
  onNewConversation: () => void;
  onClearChat: () => void;
  sessionMessages: any[];
  isLoading: boolean;
}

export function ChatDrawers({
  showConversations,
  setShowConversations,
  showQuickActions,
  setShowQuickActions,
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  fetchConversations,
  onSendMessage,
  activeTrigger,
  onTriggerChange,
  onTextGenerated,
  onNewConversation,
  onClearChat,
  sessionMessages,
  isLoading
}: ChatDrawersProps) {
  const { language } = useTheme();
  const extraDrawerRef = useRef<HTMLDivElement>(null);
  const quickActionsDrawerRef = useRef<HTMLDivElement>(null);
  const [ttsAutoPlay, setTtsAutoPlay] = useState(false);

  // Focus management for Extra drawer
  useEffect(() => {
    if (showConversations && extraDrawerRef.current) {
      // Small delay to ensure the drawer is fully mounted
      const timer = setTimeout(() => {
        const firstFocusable = extraDrawerRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          (firstFocusable as HTMLElement).focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showConversations]);

  // Focus management for Quick Actions drawer
  useEffect(() => {
    if (showQuickActions && quickActionsDrawerRef.current) {
      // Small delay to ensure the drawer is fully mounted
      const timer = setTimeout(() => {
        const firstFocusable = quickActionsDrawerRef.current?.querySelector('button, [href], [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
          (firstFocusable as HTMLElement).focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showQuickActions]);

  // Initialize TTS Auto Play from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem('wakti_tts_autoplay');
      setTtsAutoPlay(v === '1');
    } catch {}
  }, []);

  // Listen for external changes (from ChatInput toggle)
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

  const toggleTtsAutoPlay = () => {
    setTtsAutoPlay((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wakti_tts_autoplay', next ? '1' : '0');
      } catch {}
      // Broadcast so other components (e.g., ChatInput) stay in sync
      try {
        window.dispatchEvent(new CustomEvent('wakti-tts-autoplay-changed', { detail: { value: next } }));
      } catch {}
      return next;
    });
  };

  return (
    <div>
      {/* Extra Drawer - slides from left */}
      <Drawer open={showConversations} onOpenChange={setShowConversations}>
        <DrawerContent 
          side="left" 
          ref={extraDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="extra-drawer-title"
          aria-describedby="extra-drawer-desc"
        >
          <DrawerHeader>
            <DrawerTitle id="extra-drawer-title">
              {language === 'ar' ? 'إضافي' : 'Extra'}
            </DrawerTitle>
            <DrawerDescription id="extra-drawer-desc" className="sr-only">
              {language === 'ar' 
                ? 'لوحة تحتوي على المحادثات السابقة والإعدادات' 
                : 'Panel containing previous conversations and settings'}
            </DrawerDescription>
          </DrawerHeader>
          {/* Mini Auto Play toggle under header (Option A) */}
          <div className="px-4 -mt-2 pb-1 flex justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleTtsAutoPlay}
                    className={`h-7 px-2 rounded-lg text-[11px] leading-none flex items-center gap-1 border transition-colors
                      ${ttsAutoPlay
                        ? 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700/50'
                        : 'bg-white/60 text-foreground/80 border-white/60 dark:bg-white/10 dark:text-white/80 dark:border-white/10'}
                    `}
                    aria-pressed={ttsAutoPlay}
                    aria-label={language === 'ar' ? 'تشغيل تلقائي للصوت' : 'Auto Play voice'}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: ttsAutoPlay ? '#0ea5e9' : '#9ca3af' }}
                      aria-hidden="true"
                    />
                    <span>{language === 'ar' ? 'تشغيل تلقائي' : 'Auto Play'}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs bg-black/80 dark:bg-white/80 backdrop-blur-xl border-0 rounded-xl">
                  {language === 'ar' ? 'تشغيل صوت الرد التالي تلقائيًا' : 'Auto play next assistant reply'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex-1 overflow-hidden">
            <ExtraPanel
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
              onRefresh={fetchConversations}
              onClose={() => setShowConversations(false)}
              onNewConversation={onNewConversation}
              onClearChat={onClearChat}
              sessionMessages={sessionMessages}
              isLoading={isLoading}
            />
          </div>
        </DrawerContent>
      </Drawer>

      {/* Quick Actions Drawer - slides from right */}
      <Drawer open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DrawerContent 
          side="right" 
          ref={quickActionsDrawerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-actions-title"
          aria-describedby="quick-actions-desc"
        >
          <DrawerHeader>
            <DrawerTitle id="quick-actions-title" className="sr-only">
              {language === 'ar' ? 'الإجراءات السريعة' : 'Quick Actions'}
            </DrawerTitle>
            <DrawerDescription id="quick-actions-desc" className="sr-only">
              {language === 'ar'
                ? 'اختر من أدوات الذكاء الاصطناعي السريعة لإنشاء محتوى أو تحسينه'
                : 'Choose from quick AI tools to create or enhance content'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden">
            <QuickActionsPanel 
              onSendMessage={onSendMessage} 
              activeTrigger={activeTrigger} 
              onTriggerChange={onTriggerChange} 
              onTextGenerated={onTextGenerated} 
              onClose={() => setShowQuickActions(false)} 
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
