import { useState } from 'react';
import { ArrowLeft, Save, Loader2, ChevronDown, ChevronUp, Cpu, MessageSquare, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChatbotBot, ChatbotService } from '@/services/chatbotService';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  bot: ChatbotBot;
  onBack: () => void;
  onSave: (updated: ChatbotBot) => void;
  isRTL: boolean;
}

type SectionId = 'basic' | 'personality' | 'summary';

const GPT_MODELS = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', desc: 'Fast' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Creative' },
];

const LANGUAGES = ['English', 'Arabic', 'French', 'Spanish', 'German', 'Portuguese'];

const PERSONALITY_TONES = [
  { id: 'professional', label: 'Professional', labelAr: 'احترافي', emoji: '💼' },
  { id: 'friendly', label: 'Friendly', labelAr: 'ودود', emoji: '😊' },
  { id: 'formal', label: 'Formal', labelAr: 'رسمي', emoji: '🎩' },
  { id: 'casual', label: 'Casual', labelAr: 'غير رسمي', emoji: '😎' },
  { id: 'empathetic', label: 'Empathetic', labelAr: 'متعاطف', emoji: '🤝' },
  { id: 'concise', label: 'Concise', labelAr: 'موجز', emoji: '⚡' },
];

// ─── Accordion Section ─────────────────────────────────────────────────────────
function AccordionSection({
  id, open, onToggle, icon, color, title, titleAr, desc, descAr, isRTL, children,
}: {
  id: SectionId; open: boolean; onToggle: () => void;
  icon: React.ReactNode; color: string;
  title: string; titleAr: string; desc: string; descAr: string;
  isRTL: boolean; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-white dark:bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + '18' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{isRTL ? titleAr : title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{isRTL ? descAr : desc}</p>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border/30">
          <div className="pt-4 space-y-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "w-11 h-6 rounded-full transition-all duration-200 relative shrink-0",
        value ? "bg-emerald-500" : "bg-muted border border-border/50"
      )}
    >
      <div className={cn(
        "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-200",
        value ? "left-[22px]" : "left-0.5"
      )} />
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function ChatbotAISettings({ bot, onBack, onSave, isRTL }: Props) {
  const [openSection, setOpenSection] = useState<SectionId | null>('basic');
  const [saving, setSaving] = useState(false);

  // Basic config state
  const [model, setModel] = useState('gemini-2.5-flash-lite');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(100);
  const [fallbackMsg, setFallbackMsg] = useState("I'm sorry, I didn't understand that. Could you rephrase?");

  // Personality state
  const [tone, setTone] = useState('professional');
  const [systemPrompt, setSystemPrompt] = useState(bot.system_prompt || '');
  const [responseLength, setResponseLength] = useState<'short' | 'medium' | 'long'>('medium');

  // Chat summary state
  const [summaryEnabled, setSummaryEnabled] = useState(true);
  const [summaryLang, setSummaryLang] = useState('English');
  const [onlyIfInteracted, setOnlyIfInteracted] = useState(true);
  const [restrictByCount, setRestrictByCount] = useState(true);
  const [minMessages, setMinMessages] = useState(2);
  const [summaryPrompt, setSummaryPrompt] = useState(
    'Summarize the conversation in 2–3 short bullet points. Highlight the user\'s main intent, key questions asked, and the final outcome or next action.'
  );

  const toggle = (id: SectionId) => setOpenSection(prev => prev === id ? null : id);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ChatbotService.updateBot(bot.id, {
        system_prompt: systemPrompt,
      });
      onSave({ ...bot, system_prompt: systemPrompt });
      toast.success(isRTL ? 'تم حفظ الإعدادات!' : 'AI Settings saved!');
    } catch {
      toast.error(isRTL ? 'فشل الحفظ' : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Back */}
      <div className="flex mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#060541] dark:text-white/80 hover:opacity-70 bg-white dark:bg-white/8 border border-[#060541]/20 dark:border-white/15 px-4 py-2 rounded-xl shadow-sm active:scale-95 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          {isRTL ? 'رجوع' : 'Back'}
        </button>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">
          {isRTL ? 'إعدادات الذكاء الاصطناعي' : 'Configure Bot Behaviour'}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {isRTL
            ? 'خصص شخصية البوت، وإعدادات النموذج، وملخص المحادثة'
            : "Configure bot's personality, redact customer data, handle flow and ChatGPT model"}
        </p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">

        {/* ── BASIC CONFIGURATION ── */}
        <AccordionSection
          id="basic" open={openSection === 'basic'} onToggle={() => toggle('basic')}
          icon={<Cpu className="h-4 w-4" />} color="#0ea5e9"
          title="Basic Configuration" titleAr="الإعداد الأساسي"
          desc="Configure your basic model and other settings"
          descAr="اضبط النموذج الأساسي والإعدادات الأخرى"
          isRTL={isRTL}
        >
          {/* Model */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'نموذج الذكاء الاصطناعي' : 'AI Model'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {GPT_MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all duration-200",
                    model === m.id
                      ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10"
                      : "border-border/40 hover:border-border"
                  )}
                >
                  <span className="text-xs font-bold text-foreground">{m.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {isRTL ? 'درجة الإبداع' : 'Creativity (Temperature)'}
              </label>
              <span className="text-xs font-mono font-bold text-foreground">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range" min={0} max={1} step={0.1}
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#060541]"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{isRTL ? 'دقيق' : 'Precise'}</span>
              <span>{isRTL ? 'إبداعي' : 'Creative'}</span>
            </div>
          </div>

          {/* Max tokens */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'الحد الأقصى للرموز' : 'Max Response Tokens'}
            </label>
            <input
              type="number" min={10} max={100} step={10}
              value={maxTokens}
              onChange={e => setMaxTokens(Math.min(100, Math.max(1, parseInt(e.target.value) || 10)))}
              className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{isRTL ? 'يؤثر على طول الردود (الحد الأقصى 100)' : 'Affects response length (Max 100)'}</p>
          </div>

          {/* Fallback message */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'رسالة الاحتياط' : 'Fallback Message'}
            </label>
            <textarea
              value={fallbackMsg}
              onChange={e => setFallbackMsg(e.target.value)}
              rows={2}
              className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 resize-none"
              placeholder="When AI doesn't understand..."
            />
          </div>
        </AccordionSection>

        {/* ── PERSONALITY ── */}
        <AccordionSection
          id="personality" open={openSection === 'personality'} onToggle={() => toggle('personality')}
          icon={<MessageSquare className="h-4 w-4" />} color="#f59e0b"
          title="Configure Bot's Personality" titleAr="شخصية البوت"
          desc="Manage how your bot should respond in terms of personality"
          descAr="حدد كيف يجب أن يرد البوت من حيث الشخصية"
          isRTL={isRTL}
        >
          {/* Tone */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'نبرة الصوت' : 'Conversation Tone'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PERSONALITY_TONES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-xl border-2 text-left transition-all duration-200",
                    tone === t.id
                      ? "border-[#060541] dark:border-white bg-[#060541]/5 dark:bg-white/10"
                      : "border-border/40 hover:border-border"
                  )}
                >
                  <span className="text-base">{t.emoji}</span>
                  <span className="text-xs font-semibold text-foreground">{isRTL ? t.labelAr : t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Response length */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'طول الرد' : 'Response Length'}
            </label>
            <div className="flex gap-2">
              {(['short', 'medium', 'long'] as const).map(len => (
                <button
                  key={len}
                  onClick={() => setResponseLength(len)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-bold border-2 capitalize transition-all duration-200",
                    responseLength === len
                      ? "border-[#060541] dark:border-white bg-[#060541] dark:bg-white text-white dark:text-[#060541]"
                      : "border-border/40 text-muted-foreground hover:border-border"
                  )}
                >
                  {isRTL ? (len === 'short' ? 'قصير' : len === 'medium' ? 'متوسط' : 'طويل') : len}
                </button>
              ))}
            </div>
          </div>

          {/* System prompt */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              {isRTL ? 'التعليمات المخصصة (System Prompt)' : 'Custom Instructions (System Prompt)'}
            </label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              rows={5}
              maxLength={1500}
              className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 resize-none"
              placeholder={isRTL
                ? 'أنت مساعد ودود يعمل لصالح شركة...'
                : 'You are a helpful assistant for a company that sells... Always respond in a professional tone...'}
            />
            <p className="text-[10px] text-muted-foreground mt-1">{systemPrompt.length}/1500 {isRTL ? 'حرف' : 'characters'}</p>
          </div>
        </AccordionSection>

        {/* ── CHAT SUMMARY ── */}
        <AccordionSection
          id="summary" open={openSection === 'summary'} onToggle={() => toggle('summary')}
          icon={<FileText className="h-4 w-4" />} color="#f59e0b"
          title="Configure Chat Summary" titleAr="ملخص المحادثة"
          desc="Here's a brief overview of the conversation"
          descAr="ملخص موجز للمحادثة"
          isRTL={isRTL}
        >
          {/* AI Chat Summary toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{isRTL ? 'ملخص المحادثة بالذكاء الاصطناعي' : 'AI Chat Summary'}</p>
            </div>
            <Toggle value={summaryEnabled} onChange={setSummaryEnabled} />
          </div>

          {summaryEnabled && (
            <>
              {/* Info banner */}
              <div className="flex gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                  {isRTL
                    ? 'كل توليد ملخص يستهلك رصيداً واحداً من الذكاء الاصطناعي'
                    : 'Each summary generation consumes one AI credit (Involves your AI messages or API key credits)'}
                </p>
              </div>

              {/* Language */}
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  {isRTL ? 'لغة الملخص' : 'Select Preferred Summary Language'}
                </label>
                <select
                  value={summaryLang}
                  onChange={e => setSummaryLang(e.target.value)}
                  className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>

              {/* Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{isRTL ? 'فقط إذا تفاعل المستخدم' : 'Generate only if user Interacted'}</p>
                  <Toggle value={onlyIfInteracted} onChange={setOnlyIfInteracted} />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{isRTL ? 'تقييد بعدد الرسائل' : 'Restrict based on number of messages'}</p>
                  <Toggle value={restrictByCount} onChange={setRestrictByCount} />
                </div>
              </div>

              {/* Min messages */}
              {restrictByCount && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    {isRTL ? 'الحد الأدنى من التفاعلات' : 'Number # of Interactions'}
                  </label>
                  <input
                    type="number" min={1} max={50}
                    value={minMessages}
                    onChange={e => setMinMessages(parseInt(e.target.value))}
                    className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30"
                  />
                </div>
              )}

              {/* Custom prompt */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-lg bg-[#060541]/10 dark:bg-white/10 flex items-center justify-center">
                    <MessageSquare className="h-3.5 w-3.5 text-[#060541] dark:text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{isRTL ? 'تعليمات مخصصة' : 'Custom Instructions'}</p>
                    <p className="text-[10px] text-muted-foreground">{isRTL ? 'أضف تعليمات مخصصة لتوليد الملخص' : 'Add custom instruction to add new capabilities'}</p>
                  </div>
                </div>
                <textarea
                  value={summaryPrompt}
                  onChange={e => setSummaryPrompt(e.target.value)}
                  rows={4}
                  maxLength={1500}
                  className="w-full border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-background focus:outline-none focus:border-[#060541]/50 dark:focus:border-white/30 resize-none"
                  placeholder="Summarize the conversation in 2–3 short bullet points..."
                />
                <p className="text-[10px] text-muted-foreground mt-1">{summaryPrompt.length}/1500 {isRTL ? 'حرف' : 'characters'}</p>
              </div>
            </>
          )}
        </AccordionSection>
      </div>

      {/* Save / Discard */}
      <div className="flex gap-3 mt-6">
        <Button
          variant="outline"
          className="flex-1 rounded-xl h-11"
          onClick={onBack}
        >
          {isRTL ? 'إلغاء' : 'Discard'}
        </Button>
        <Button
          className="flex-1 rounded-xl h-11 bg-[#060541] hover:bg-[#060541]/90 text-white dark:bg-white dark:text-[#060541] gap-2"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isRTL ? 'حفظ' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
