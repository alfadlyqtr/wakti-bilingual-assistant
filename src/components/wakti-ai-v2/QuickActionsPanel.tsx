import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Languages, Settings, Brain, Search, Zap, MessageSquare, Image, PenTool, ShoppingCart, ChevronDown, User, TrendingUp, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceTranslatorPopup } from './VoiceTranslatorPopup';
import { BuyExtrasPopup } from './BuyExtrasPopup';

// Updated trigger types with stylized art
type TriggerMode = 'chat' | 'search' | 'advanced_search' | 'image';
type ImageMode = 'regular' | 'photomaker' | 'upscaling' | 'stylized';

interface QuickActionsPanelProps {
  onSendMessage: (message: string) => void;
  activeTrigger: TriggerMode;
  onTriggerChange: (trigger: TriggerMode) => void;
  imageMode: ImageMode;
  onImageModeChange: (imageMode: ImageMode) => void;
}

export function QuickActionsPanel({ 
  onSendMessage, 
  activeTrigger, 
  onTriggerChange, 
  imageMode, 
  onImageModeChange 
}: QuickActionsPanelProps) {
  const { language } = useTheme();
  const [customActionDialogOpen, setCustomActionDialogOpen] = useState(false);
  const [voiceTranslatorOpen, setVoiceTranslatorOpen] = useState(false);
  const [buyExtrasOpen, setBuyExtrasOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  // Save trigger state to localStorage and dispatch event for header
  React.useEffect(() => {
    localStorage.setItem('wakti-ai-active-trigger', activeTrigger);
    localStorage.setItem('wakti-ai-image-mode', imageMode);
    window.dispatchEvent(new Event('ai-trigger-change'));
  }, [activeTrigger, imageMode]);

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
    }
  ];

  // Image generation dropdown options with stylized art
  const imageOptions = [
    {
      id: 'regular' as ImageMode,
      label: language === 'ar' ? 'مولد الصور' : 'Image Generator',
      description: language === 'ar' ? 'إنشاء الصور العادية' : 'Regular image creation',
      icon: Image
    },
    {
      id: 'photomaker' as ImageMode,
      label: language === 'ar' ? 'صانع الصور الشخصية' : 'Photo Maker Personal',
      description: language === 'ar' ? 'إنشاء صور شخصية مخصصة' : 'Custom personal images',
      icon: User
    },
    {
      id: 'upscaling' as ImageMode,
      label: language === 'ar' ? 'تحسين جودة الصورة' : 'Image Upscaling',
      description: language === 'ar' ? 'تحسين جودة ودقة الصورة' : 'Enhance image quality & resolution',
      icon: TrendingUp
    },
    {
      id: 'stylized' as ImageMode,
      label: language === 'ar' ? 'مولد الفن المخصص' : 'Stylized Art Generator',
      description: language === 'ar' ? 'تحويل الصور إلى أنماط فنية' : 'Transform images into artistic styles',
      icon: Palette
    }
  ];

  const getImageModeDisplay = () => {
    const activeImageMode = imageOptions.find(option => option.id === imageMode);
    return activeImageMode ? activeImageMode.label : (language === 'ar' ? 'صورة' : 'Image');
  };

  const getImageModeIcon = () => {
    const activeImageMode = imageOptions.find(option => option.id === imageMode);
    return activeImageMode ? activeImageMode.icon : Image;
  };

  const handleCustomAction = () => {
    if (customLabel && customMessage) {
      onSendMessage(customMessage);
      setCustomActionDialogOpen(false);
      setCustomLabel('');
      setCustomMessage('');
    }
  };

  const handleTryExample = (example: string) => {
    onSendMessage(example);
    // If in search mode, auto-switch to chat mode for better experience
    if (activeTrigger === 'search') {
      setTimeout(() => {
        onTriggerChange('chat');
      }, 100);
    }
  };

  const handleImageTriggerClick = () => {
    onTriggerChange('image');
    // When switching to image trigger, ensure we have a valid image mode
    if (imageMode !== 'regular' && imageMode !== 'photomaker' && imageMode !== 'upscaling' && imageMode !== 'stylized') {
      onImageModeChange('regular');
    }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      {/* AI Trigger Controls */}
      <div className="flex-shrink-0">
        <h3 className="font-semibold text-xs text-muted-foreground flex items-center gap-1.5 mb-3">
          <Brain className="h-3 w-3" />
          {language === 'ar' ? 'وضع الذكاء الاصطناعي' : 'AI Mode'}
        </h3>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Regular trigger buttons */}
          {triggerButtons.map((trigger) => (
            <Button
              key={trigger.id}
              variant={activeTrigger === trigger.id ? "default" : "outline"}
              className={cn(
                "h-16 p-2 flex flex-col items-center justify-center gap-1 text-center transition-all duration-200 text-xs",
                activeTrigger === trigger.id && "ring-2 ring-primary ring-offset-1"
              )}
              onClick={() => onTriggerChange(trigger.id)}
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

          {/* Image Generation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={activeTrigger === 'image' ? "default" : "outline"}
                className={cn(
                  "h-16 p-2 flex flex-col items-center justify-center gap-1 text-center transition-all duration-200 text-xs",
                  activeTrigger === 'image' && "ring-2 ring-primary ring-offset-1"
                )}
                onClick={handleImageTriggerClick}
              >
                <div className={cn(
                  "p-1.5 rounded-md flex items-center gap-1",
                  activeTrigger === 'image' ? "bg-primary-foreground" : "bg-orange-500"
                )}>
                  {React.createElement(getImageModeIcon(), {
                    className: cn(
                      "h-3 w-3",
                      activeTrigger === 'image' ? "text-primary" : "text-white"
                    )
                  })}
                  <ChevronDown className={cn(
                    "h-2 w-2",
                    activeTrigger === 'image' ? "text-primary" : "text-white"
                  )} />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] font-medium">{getImageModeDisplay()}</div>
                  <div className="text-[8px] text-muted-foreground">
                    {language === 'ar' ? 'إنشاء الصور' : 'Image generation'}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="center">
              {imageOptions.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  onClick={() => {
                    onTriggerChange('image');
                    onImageModeChange(option.id);
                  }}
                  className="flex flex-col items-start p-3"
                >
                  <div className="flex items-center gap-2 w-full">
                    <option.icon className="h-4 w-4" />
                    <span className="font-medium">{option.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">{option.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
            onClick={() => onSendMessage(language === 'ar' ? 'اكتب نصاً لي' : 'Generate text for me')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-teal-500 to-cyan-500">
              <PenTool className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'إنشاء نص' : 'Text Generate'}
            </span>
          </Button>
          
          {/* Improve AI Button */}
          <Button
            variant="ghost"
            className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
            onClick={() => onSendMessage(language === 'ar' ? 'كيف يمكنني تحسين استخدام الذكاء الاصطناعي؟' : 'How can I improve my AI usage?')}
          >
            <div className="p-1 rounded-sm bg-gradient-to-r from-violet-500 to-purple-500">
              <Brain className="h-3 w-3 text-white" />
            </div>
            <span className="text-[10px] font-medium leading-tight">
              {language === 'ar' ? 'تحسين الذكاء الاصطناعي' : 'Improve AI'}
            </span>
          </Button>
          
          {/* Custom Input Action */}
          <Dialog open={customActionDialogOpen} onOpenChange={setCustomActionDialogOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="h-16 p-2 flex flex-col items-center justify-center gap-1 hover:scale-105 transition-all duration-200 border border-border/50 hover:border-border text-center"
              >
                <div className="p-1 rounded-sm bg-gradient-to-r from-gray-500 to-slate-500">
                  <Settings className="h-3 w-3 text-white" />
                </div>
                <span className="text-[10px] font-medium leading-tight">
                  {language === 'ar' ? 'إدخال مخصص' : 'Custom Input'}
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {language === 'ar' ? 'إنشاء إجراء مخصص' : 'Create Custom Action'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-label">
                    {language === 'ar' ? 'تسمية الإجراء' : 'Action Label'}
                  </Label>
                  <Input
                    id="custom-label"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: ملخص ذكي' : 'e.g., AI Summary'}
                  />
                </div>
                <div>
                  <Label htmlFor="custom-message">
                    {language === 'ar' ? 'الرسالة المرسلة' : 'Message to Send'}
                  </Label>
                  <Input
                    id="custom-message"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: لخص هذا النص' : 'e.g., Summarize this text'}
                  />
                </div>
                <Button onClick={handleCustomAction} className="w-full">
                  {language === 'ar' ? 'إنشاء' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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

      {/* PhotoMaker instructions - ONLY visible in photomaker mode */}
      {activeTrigger === 'image' && imageMode === 'photomaker' && (
        <div className="flex-1 pt-2 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {language === 'ar' ? 'تعليمات صانع الصور الشخصية' : 'PhotoMaker Instructions'}
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '📸 رفع الصور:' : '📸 Upload Images:'}
              </p>
              <p>{language === 'ar' ? '• 1-4 صور بوجوه واضحة' : '• 1-4 images with clear faces'}</p>
              <p>{language === 'ar' ? '• استخدم أزرار الرفع أسفل الشاشة' : '• Use upload buttons below screen'}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '✍️ كتابة الوصف:' : '✍️ Write Prompt:'}
              </p>
              <p>{language === 'ar' ? '• اكتب وصف الصورة المطلوبة' : '• Describe the desired image'}</p>
              <p>{language === 'ar' ? '• سيتم إضافة "rwre" تلقائياً' : '• "rwre" will be added automatically'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Image Upscaling instructions - ONLY visible in upscaling mode */}
      {activeTrigger === 'image' && imageMode === 'upscaling' && (
        <div className="flex-1 pt-2 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {language === 'ar' ? 'تعليمات تحسين الصور' : 'Image Upscaling Instructions'}
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '📸 رفع الصورة:' : '📸 Upload Image:'}
              </p>
              <p>{language === 'ar' ? '• صورة واحدة فقط' : '• Single image only'}</p>
              <p>{language === 'ar' ? '• سيتم تحسين الجودة والدقة' : '• Quality & resolution will be enhanced'}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '⚡ معالجة:' : '⚡ Processing:'}
              </p>
              <p>{language === 'ar' ? '• التحسين بمعامل 2x' : '• 2x upscaling factor'}</p>
              <p>{language === 'ar' ? '• جودة عالية 95%' : '• High quality 95%'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stylized Art instructions - ONLY visible in stylized mode */}
      {activeTrigger === 'image' && imageMode === 'stylized' && (
        <div className="flex-1 pt-2 border-t border-border/50">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            {language === 'ar' ? 'تعليمات مولد الفن المخصص' : 'Stylized Art Instructions'}
          </h4>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '📸 رفع الصورة:' : '📸 Upload Image:'}
              </p>
              <p>{language === 'ar' ? '• صورة واحدة فقط' : '• Single image only'}</p>
              <p>{language === 'ar' ? '• سيتم تحويلها حسب النمط المطلوب' : '• Will be transformed to desired style'}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="font-medium mb-1">
                {language === 'ar' ? '🎨 أمثلة على الأنماط:' : '🎨 Style Examples:'}
              </p>
              <p>{language === 'ar' ? '• "شخصية ديزني"' : '• "Disney character"'}</p>
              <p>{language === 'ar' ? '• "أسلوب أنمي"' : '• "Anime style"'}</p>
              <p>{language === 'ar' ? '• "قصة مصورة"' : '• "Comic book style"'}</p>
            </div>
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
        onOpenChange={setVoiceTranslatorOpen} 
      />

      {/* Buy Extras Popup */}
      <BuyExtrasPopup 
        open={buyExtrasOpen} 
        onOpenChange={setBuyExtrasOpen} 
      />
    </div>
  );
}
