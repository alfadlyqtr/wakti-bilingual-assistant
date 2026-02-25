import { useState, useCallback } from 'react';
import { ArrowLeft, Save, Send, Smile, X, Check, Loader2, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatbotBot, ChatbotService } from '@/services/chatbotService';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  bot: ChatbotBot;
  onBack: () => void;
  onSave: (updated: ChatbotBot) => void;
  isRTL: boolean;
}

type DesignTab = 'content' | 'theme' | 'layout';
type PreviewDevice = 'desktop' | 'mobile';

const THEME_COLORS = [
  '#060541', '#0ea5e9', '#3b82f6', '#8b5cf6',
  '#ec4899', '#ef4444', '#f59e0b', '#10b981',
  '#06b6d4', '#000000', '#374151', '#6366f1',
];

const BG_COLORS = [
  '#ffffff', '#f8fafc', '#f0f9ff', '#fdf4ff',
  '#fff7ed', '#f0fdf4', '#0c0f14', '#1e293b',
  '#0f172a', '#1a1a2e', '#111827', '#18181b',
];

const BOT_AVATARS = ['🤖', '🦾', '💬', '🌟', '⚡', '🎯', '🚀', '💎', '🔮', '🌊'];

const POSITION_WEB = [
  { id: 'bottom-left', label: 'Bottom Left', icon: '↙' },
  { id: 'bottom-center', label: 'Bottom Center', icon: '↓' },
  { id: 'bottom-right', label: 'Bottom Right', icon: '↘' },
];

const WINDOW_SIZES = ['S', 'M', 'L', 'XL'];

// ─── Live Preview ──────────────────────────────────────────────────────────────
function ChatPreview({ bot, design, device }: {
  bot: ChatbotBot;
  design: DesignState;
  device: PreviewDevice;
}) {
  const accentColor = design.primaryColor || bot.primary_color || '#060541';
  const bgColor = design.bgColor;
  const botName = design.botName || bot.name;
  const welcomeMsg = design.welcomeMessage || bot.welcome_message || 'Hello! 👋 How can I assist you?';

  const isMobile = device === 'mobile';

  return (
    <div className={cn(
      "relative bg-gray-100 dark:bg-zinc-900 rounded-2xl overflow-hidden flex items-end justify-end transition-all duration-500",
      isMobile ? "w-[280px] h-[500px] mx-auto" : "w-full h-full"
    )}>
      {/* Fake browser/phone chrome */}
      {!isMobile && (
        <div className="absolute top-0 left-0 right-0 h-8 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 px-3 z-10">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <div className="flex-1 mx-3 h-4 bg-zinc-100 dark:bg-zinc-700 rounded-full" />
        </div>
      )}
      {isMobile && (
        <div className="absolute top-0 left-0 right-0 h-6 bg-zinc-800 flex items-center justify-center z-10">
          <div className="w-16 h-1 rounded-full bg-zinc-600" />
        </div>
      )}

      {/* Fake page content */}
      <div className={cn("absolute inset-0 p-4 space-y-2", isMobile ? "pt-8" : "pt-10")}>
        {[80, 60, 90, 50, 70, 40, 65, 55].map((w, i) => (
          <div key={i} className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-700" style={{ width: `${w}%` }} />
        ))}
      </div>

      {/* Chat widget */}
      <div className={cn(
        "absolute flex flex-col rounded-2xl shadow-2xl overflow-hidden transition-all duration-300",
        isMobile
          ? "bottom-4 right-2 left-2"
          : design.position === 'bottom-left'
            ? "bottom-4 left-4 w-[300px]"
            : design.position === 'bottom-center'
              ? "bottom-4 left-1/2 -translate-x-1/2 w-[300px]"
              : "bottom-4 right-4 w-[300px]"
      )} style={{ maxHeight: isMobile ? '380px' : '380px' }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 shrink-0" style={{ background: accentColor }}>
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
            {design.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm truncate">{botName}</p>
            <p className="text-white/70 text-[10px]">● Online now</p>
          </div>
          <div className="flex gap-1">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <X className="h-3 w-3 text-white" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" style={{ background: bgColor }}>
          {/* Bot messages */}
          <div className="flex gap-2 items-end">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: accentColor }}>
              {design.avatar}
            </div>
            <div className="max-w-[80%]">
              <div className="bg-white dark:bg-zinc-700 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                <p className="text-xs text-zinc-800 dark:text-zinc-100 leading-relaxed">{welcomeMsg}</p>
              </div>
              <p className="text-[9px] text-zinc-400 mt-0.5 ml-1">Bot · just now</p>
            </div>
          </div>

          {design.callToAction && (
            <div className="flex gap-2 items-end">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0" style={{ background: accentColor }}>
                {design.avatar}
              </div>
              <div className="max-w-[80%]">
                <div className="bg-white dark:bg-zinc-700 rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
                  <p className="text-xs text-zinc-800 dark:text-zinc-100">{design.callToAction}</p>
                </div>
              </div>
            </div>
          )}

          {/* User message */}
          <div className="flex justify-end">
            <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-br-sm text-white text-xs" style={{ background: accentColor }}>
              Sure, I'd love to!
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700 shrink-0">
          <input
            readOnly
            placeholder="Type your answer..."
            className="flex-1 text-xs bg-transparent outline-none text-zinc-500 placeholder:text-zinc-400"
          />
          <Smile className="h-4 w-4 text-zinc-400 shrink-0" />
          <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: accentColor }}>
            <Send className="h-3 w-3 text-white" />
          </div>
        </div>

        {/* Powered by */}
        <div className="text-center py-1 bg-white dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-700">
          <p className="text-[9px] text-zinc-400">Powered by <span className="font-bold text-zinc-600 dark:text-zinc-300">Wakti AI</span></p>
        </div>
      </div>
    </div>
  );
}

// ─── Design State ──────────────────────────────────────────────────────────────
interface DesignState {
  botName: string;
  callToAction: string;
  welcomeMessage: string;
  primaryColor: string;
  bgColor: string;
  avatar: string;
  position: 'bottom-left' | 'bottom-center' | 'bottom-right';
  windowSize: 'S' | 'M' | 'L' | 'XL';
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ChatbotDesigner({ bot, onBack, onSave, isRTL }: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<DesignTab>('content');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');
  const [saving, setSaving] = useState(false);

  const [design, setDesign] = useState<DesignState>({
    botName: bot.name,
    callToAction: 'May I help you?',
    welcomeMessage: bot.welcome_message || 'Hello! 👋 How can I assist you?',
    primaryColor: bot.primary_color || '#060541',
    bgColor: '#f8fafc',
    avatar: '🤖',
    position: 'bottom-right',
    windowSize: 'M',
  });

  const update = useCallback(<K extends keyof DesignState>(key: K, val: DesignState[K]) => {
    setDesign(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ChatbotService.updateBot(bot.id, {
        name: design.botName,
        primary_color: design.primaryColor,
        welcome_message: design.welcomeMessage,
      });
      onSave({ ...bot, name: design.botName, primary_color: design.primaryColor, welcome_message: design.welcomeMessage });
      toast.success(isRTL ? 'تم حفظ التصميم!' : 'Design saved!');
    } catch {
      toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const TABS: { id: DesignTab; label: string; labelAr: string }[] = [
    { id: 'content', label: 'Content', labelAr: 'المحتوى' },
    { id: 'theme', label: 'Theme', labelAr: 'المظهر' },
    { id: 'layout', label: 'Layout', labelAr: 'التخطيط' },
  ];

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── LEFT PANEL ── */}
      <div className="w-[340px] shrink-0 flex flex-col border-r border-border/50 bg-background overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 shrink-0">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:opacity-70 transition-opacity mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            {isRTL ? 'رجوع' : 'Back'}
          </button>
          <h1 className="text-xl font-bold text-foreground">
            {isRTL ? 'تصميم البوت' : 'Design Your Chatbot'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRTL ? 'خصص مظهر وإعدادات البوت' : 'Customize theme as per your brand guidelines'}
          </p>
        </div>

        {/* Tabs */}
        <div className="px-5 shrink-0">
          <div className="flex gap-1 p-1 bg-muted/60 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-[#060541] text-white dark:bg-white dark:text-[#060541] shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isRTL ? tab.labelAr : tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

          {/* ── CONTENT TAB ── */}
          {activeTab === 'content' && (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  {isRTL ? 'اسم البوت' : 'Bot Name'}
                </label>
                <input
                  value={design.botName}
                  onChange={e => update('botName', e.target.value)}
                  maxLength={45}
                  className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 transition-colors"
                  placeholder="My Awesome Bot"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{45 - design.botName.length} {isRTL ? 'حرف متبقي' : 'characters remaining'}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  {isRTL ? 'رسالة الترحيب' : 'Welcome Message'}
                </label>
                <textarea
                  value={design.welcomeMessage}
                  onChange={e => update('welcomeMessage', e.target.value)}
                  rows={3}
                  className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 resize-none transition-colors"
                  placeholder="Hello! How can I help you today?"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  {isRTL ? 'نداء للعمل' : 'Call to Action'}
                </label>
                <input
                  value={design.callToAction}
                  onChange={e => update('callToAction', e.target.value)}
                  maxLength={65}
                  className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 transition-colors"
                  placeholder="May I help you?"
                />
                <p className="text-[10px] text-muted-foreground mt-1">{65 - design.callToAction.length} {isRTL ? 'حرف متبقي' : 'characters remaining'}</p>
              </div>
            </>
          )}

          {/* ── THEME TAB ── */}
          {activeTab === 'theme' && (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  {isRTL ? 'أيقونة البوت' : 'Bot Avatar'}
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {BOT_AVATARS.map(av => (
                    <button
                      key={av}
                      onClick={() => update('avatar', av)}
                      className={cn(
                        "w-full aspect-square rounded-xl text-2xl flex items-center justify-center border-2 transition-all duration-200 hover:scale-105",
                        design.avatar === av
                          ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10 scale-105"
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  {isRTL ? 'لون الثيم' : 'Theme Color'}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {THEME_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => update('primaryColor', color)}
                      className="w-full aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-110 relative"
                      style={{
                        background: color,
                        borderColor: design.primaryColor === color ? 'white' : 'transparent',
                        boxShadow: design.primaryColor === color ? `0 0 0 2px ${color}` : 'none',
                      }}
                    >
                      {design.primaryColor === color && (
                        <Check className="h-3 w-3 text-white absolute inset-0 m-auto drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
                {/* Custom color */}
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={design.primaryColor}
                    onChange={e => update('primaryColor', e.target.value)}
                    className="w-8 h-8 rounded-lg border border-border/50 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">{isRTL ? 'لون مخصص' : 'Custom color'}</span>
                  <span className="text-xs font-mono text-foreground ml-auto">{design.primaryColor}</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  {isRTL ? 'لون خلفية المحادثة' : 'Chat Background Color'}
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {BG_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => update('bgColor', color)}
                      className="w-full aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-110 relative"
                      style={{
                        background: color,
                        borderColor: design.bgColor === color ? '#060541' : '#e5e7eb',
                        boxShadow: design.bgColor === color ? `0 0 0 2px ${color === '#ffffff' ? '#060541' : color}` : 'none',
                      }}
                    >
                      {design.bgColor === color && (
                        <Check className="h-3 w-3 absolute inset-0 m-auto drop-shadow" style={{ color: color === '#ffffff' || color === '#f8fafc' ? '#060541' : 'white' }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── LAYOUT TAB ── */}
          {activeTab === 'layout' && (
            <>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  {isRTL ? 'موضع البوت على الويب' : 'Position on Web'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {POSITION_WEB.map(pos => (
                    <button
                      key={pos.id}
                      onClick={() => update('position', pos.id as DesignState['position'])}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105",
                        design.position === pos.id
                          ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10"
                          : "border-border/40 hover:border-border"
                      )}
                    >
                      {/* Mini layout preview */}
                      <div className="w-full h-10 bg-muted/60 rounded-lg relative">
                        <div
                          className="absolute w-3 h-3 rounded-full"
                          style={{
                            background: design.position === pos.id ? '#060541' : '#94a3b8',
                            bottom: '4px',
                            left: pos.id === 'bottom-left' ? '4px' : pos.id === 'bottom-center' ? '50%' : 'auto',
                            right: pos.id === 'bottom-right' ? '4px' : 'auto',
                            transform: pos.id === 'bottom-center' ? 'translateX(-50%)' : 'none',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground">{pos.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 block">
                  {isRTL ? 'حجم النافذة' : 'Window Size'}
                </label>
                <div className="flex gap-2">
                  {WINDOW_SIZES.map(size => (
                    <button
                      key={size}
                      onClick={() => update('windowSize', size as DesignState['windowSize'])}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all duration-200",
                        design.windowSize === size
                          ? "border-[#060541] dark:border-white bg-[#060541] dark:bg-white text-white dark:text-[#060541]"
                          : "border-border/40 text-muted-foreground hover:border-border"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                <div>
                  <p className="text-sm font-semibold text-foreground">{isRTL ? 'تغيير حجم النافذة' : 'Enable Chat Window Resize'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{isRTL ? 'السماح للمستخدم بتغيير الحجم' : 'Allow users to resize the chat window'}</p>
                </div>
                <div className="w-10 h-5 rounded-full bg-muted border border-border/50 relative cursor-pointer">
                  <div className="w-4 h-4 rounded-full bg-white shadow absolute top-0.5 left-0.5 transition-transform" />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Save / Discard */}
        <div className="px-5 py-4 shrink-0 border-t border-border/30 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl h-10 text-sm"
            onClick={onBack}
          >
            {isRTL ? 'إلغاء' : 'Discard'}
          </Button>
          <Button
            className="flex-1 rounded-xl h-10 text-sm bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isRTL ? 'حفظ' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* ── RIGHT PANEL: LIVE PREVIEW ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-50 dark:bg-zinc-900/50">
        {/* Preview header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-background shrink-0">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {isRTL ? 'معاينة مباشرة' : 'Live Preview'}
          </p>
          <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-lg">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                previewDevice === 'desktop'
                  ? "bg-[#060541] text-white dark:bg-white dark:text-[#060541] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              {isRTL ? 'ويب' : 'Web'}
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                previewDevice === 'mobile'
                  ? "bg-[#060541] text-white dark:bg-white dark:text-[#060541] shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {isRTL ? 'موبايل' : 'Mobile'}
            </button>
          </div>
        </div>

        {/* Preview canvas */}
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          <div className={cn(
            "transition-all duration-500",
            previewDevice === 'desktop' ? "w-full h-full max-h-[600px]" : "h-full flex items-center"
          )}>
            <ChatPreview bot={bot} design={design} device={previewDevice} />
          </div>
        </div>

        {/* Color accent bar at bottom */}
        <div className="h-1 shrink-0 transition-all duration-300" style={{ background: design.primaryColor }} />
      </div>
    </div>
  );
}
