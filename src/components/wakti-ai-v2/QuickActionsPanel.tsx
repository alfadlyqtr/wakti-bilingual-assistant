
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Languages, Settings, Brain, Search, Zap, MessageSquare, Image, PenTool, ShoppingCart, Mic2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceTranslatorPopup } from './VoiceTranslatorPopup';
import { BuyExtrasPopup } from './BuyExtrasPopup';
import { VoiceClonePopup } from './VoiceClonePopup';
import { TextGeneratorPopup } from './TextGeneratorPopup';
import { KnowledgeModal } from './KnowledgeModal';

type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
  activeTrigger: TriggerMode;
  onTriggerChange: (trigger: TriggerMode) => void;
  onTextGenerated?: (text: string, mode: 'compose' | 'reply') => void;
  onClose?: () => void;
}

export function QuickActionsPanel({ onSendMessage, activeTrigger, onTriggerChange, onTextGenerated, onClose }: QuickActionsPanelProps) {
  const { language, toggleLanguage } = useTheme();
  const [voiceTranslatorOpen, setVoiceTranslatorOpen] = useState(false);
  const [buyExtrasOpen, setBuyExtrasOpen] = useState(false);
  const [voiceCloneOpen, setVoiceCloneOpen] = useState(false);
  const [textGeneratorOpen, setTextGeneratorOpen] = useState(false);
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);

  // Save trigger state to localStorage and dispatch event for header
  React.useEffect(() => {
    localStorage.setItem('wakti-ai-active-trigger', activeTrigger);
    window.dispatchEvent(new Event('ai-trigger-change'));
  }, [activeTrigger]);

  const triggerButtons = [
    {
      id: 'chat' as TriggerMode,
      icon: MessageSquare,
      label: language === 'ar' ? 'محادثة' : 'Chat',
      description: language === 'ar' ? 'الوضع الافتراضي' : 'Default mode',
      color: 'bg-blue-500'
    },
    {
      id: 'search' as TriggerMode,
      icon: Search,
      label: language === 'ar' ? 'بحث' : 'Search',
      description: language === 'ar' ? 'البحث والمعلومات الحديثة' : 'Search & current info',
      color: 'bg-green-500'
    },
    {
      id: 'advanced_search' as TriggerMode,
      icon: Zap,
      label: language === 'ar' ? 'بحث متقدم' : 'Advanced Search',
      description: language === 'ar' ? 'بحث عميق وتحليل' : 'Deep search & analysis',
      color: 'bg-purple-500'
    },
    {
      id: 'image' as TriggerMode,
      icon: Image,
      label: language === 'ar' ? 'صورة' : 'Image',
      description: language === 'ar' ? 'إنشاء الصور' : 'Image generation',
      color: 'bg-orange-500'
    }
  ];

  const handleTryExample = (example: string) => {
    onSendMessage(example);
    onClose?.();
    // If in search mode, auto-switch to chat mode for better experience
    if (activeTrigger === 'search') {
      setTimeout(() => {
        onTriggerChange('chat');
      }, 100);
    }
  };

  const handleTextGenerated = (text: string, mode: 'compose' | 'reply') => {
    if (onTextGenerated) {
      onTextGenerated(text, mode);
    }
    // Close drawer after text is generated and applied
    onClose?.();
  };

  const handleTriggerChange = (trigger: TriggerMode) => {
    onTriggerChange(trigger);
    onClose?.();
  };

  // Handle tool state changes - don't close drawer immediately
  const handleVoiceTranslatorChange = (open: boolean) => {
    setVoiceTranslatorOpen(open);
    // Only close drawer if tool was closed
    if (!open) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const handleBuyExtrasChange = (open: boolean) => {
    setBuyExtrasOpen(open);
    if (!open) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const handleVoiceCloneChange = (open: boolean) => {
    setVoiceCloneOpen(open);
    if (!open) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const handleTextGeneratorChange = (open: boolean) => {
    setTextGeneratorOpen(open);
    if (!open) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  const handleKnowledgeModalChange = (open: boolean) => {
    setKnowledgeModalOpen(open);
    if (!open) {
      setTimeout(() => onClose?.(), 100);
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* AI Trigger Controls */}
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5">
            <Brain className="h-3 w-3" />
            {language === 'ar' ? 'وضع الذكاء الاصطناعي' : 'AI Mode'}
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="h-9 px-3 rounded-full text-sm"
          >
            {language === 'ar' ? 'English' : 'العربية'}
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {triggerButtons.map((trigger) => (
            <Button
              key={trigger.id}
              variant={activeTrigger === trigger.id ? "default" : "outline"}
              className={cn(
                "h-16 p-2 flex flex-col items-center justify-center gap-1 text-center transition-all duration-200 text-xs",
                activeTrigger === trigger.id && "ring-2 ring-primary ring-offset-1"
              )}
              onClick={() => handleTriggerChange(trigger.id)}
            >
              <div className={cn(
                "p-1.5 rounded-md",
                activeTrigger === trigger.id ? "bg-primary-foreground" : trigger.color
              )}>
                <trigger.icon className={cn(
                  "h-3 w-3",
                  activeTrigger === trigger.id ? "text-primary" : "text-white"
                )} />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-medium">{trigger.label}</div>
                <div className="text-[8px] text-muted-foreground">{trigger.description}</div>
              </div>
            </Button>
          ))}
        </div>
      </div>

      {/* Action Buttons (Not Triggers) */}
      <div className="flex-shrink-0">
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
          <Settings className="h-3 w-3" />
          {language === 'ar' ? 'أدوات' : 'Tools'}
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Voice Translator Button */}
          <Button
            variant="ghost"
            className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
            onClick={() => setVoiceTranslatorOpen(true)}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-rose-500 to-pink-500">
              <Languages className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'مترجم' : 'Translator'}
            </span>
          </Button>
          
          {/* Text Generation Button */}
          <Button
            variant="ghost"
            className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
            onClick={() => setTextGeneratorOpen(true)}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-teal-500 to-cyan-500">
              <PenTool className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'إنشاء نص' : 'Text Generate'}
            </span>
          </Button>
          
          {/* Improve AI Button - Updated to open KnowledgeModal */}
          <Button
            variant="ghost"
            className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
            onClick={() => setKnowledgeModalOpen(true)}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-violet-500 to-purple-500">
              <Brain className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'تحسين الذكاء الاصطناعي' : 'Improve AI'}
            </span>
          </Button>
          
          {/* Voice Clone Button */}
          <Button
            variant="ghost"
            className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
            onClick={() => setVoiceCloneOpen(true)}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-indigo-500 to-blue-500">
              <Mic2 className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'استنساخ الصوت' : 'Voice Clone'}
            </span>
          </Button>
        </div>
      </div>

      {/* Try asking me section - ONLY visible in chat mode */}
      {activeTrigger === 'chat' && (
        <div className="flex-1 pt-2 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {language === 'ar' ? 'أمثلة للتجربة' : 'Try asking me'}
          </h4>
          <div className="space-y-1.5">
            {[
              language === 'ar' ? 'ما هي مهامي اليوم؟' : 'What are my tasks today?',
              language === 'ar' ? 'ساعدني في التخطيط لهذا الأسبوع' : 'Help me plan this week',
              language === 'ar' ? 'أرني تقويمي' : 'Show me my calendar'
            ].map((example, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={() => handleTryExample(example)}
              >
                "{example}"
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Buy Extras Button - Fixed at bottom */}
      <div className="flex-shrink-0 pt-3 border-t border-border/30">
        <Button
          onClick={() => setBuyExtrasOpen(true)}
          variant="outline"
          className="w-full h-12 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-950/30 dark:to-blue-950/30 border-emerald-200 dark:border-emerald-800 hover:from-emerald-100 hover:to-blue-100 dark:hover:from-emerald-900/50 dark:hover:to-blue-900/50 transition-all duration-200"
        >
          <ShoppingCart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="font-medium text-emerald-700 dark:text-emerald-300">
            {language === 'ar' ? 'شراء إضافات' : 'Buy Extras'}
          </span>
        </Button>
      </div>

      {/* Voice Translator Popup */}
      <VoiceTranslatorPopup 
        open={voiceTranslatorOpen} 
        onOpenChange={handleVoiceTranslatorChange} 
      />

      {/* Buy Extras Popup */}
      <BuyExtrasPopup 
        open={buyExtrasOpen} 
        onOpenChange={handleBuyExtrasChange} 
      />

      {/* Voice Clone Popup */}
      <VoiceClonePopup 
        open={voiceCloneOpen} 
        onOpenChange={handleVoiceCloneChange} 
      />

      {/* Text Generator Popup */}
      <TextGeneratorPopup 
        open={textGeneratorOpen} 
        onOpenChange={handleTextGeneratorChange}
        onGenerated={handleTextGenerated}
      />

      {/* Knowledge Modal */}
      <KnowledgeModal 
        open={knowledgeModalOpen} 
        onOpenChange={handleKnowledgeModalChange} 
      />
    </div>
  );
}
