import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Sparkles, Clipboard, Reply, ArrowUpRight, ListTodo, CalendarClock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { safeCopyToClipboard } from '@/utils/clipboardUtils';
import { saveSmartTextPrefill } from '@/utils/smartTextPrefill';
import { EmailAiAction, EmailAiLength, EmailAiSourceMessage, EmailAiTone, useEmailAi } from '@/hooks/useEmailAi';

const WAKTI_LOGO_SRC = '/lovable-uploads/cffe5d1a-e69b-4cd9-ae4c-43b58d4bfbb4.png';

interface EmailAiAssistantProps {
  mode: 'message' | 'recent';
  language?: string;
  contextKey: string;
  message?: EmailAiSourceMessage | null;
  resolveRecentMessages?: () => Promise<EmailAiSourceMessage[]>;
  canReply?: boolean;
  onUseAsReply?: (text: string) => void;
  variant?: 'panel' | 'floating';
}

function formatMessagesForTextTool(messages: EmailAiSourceMessage[], language: 'en' | 'ar') {
  return messages.map((message, index) => {
    const title = messages.length > 1
      ? (language === 'ar' ? `البريد ${index + 1}` : `Email ${index + 1}`)
      : (language === 'ar' ? 'البريد' : 'Email');
    const body = (message.bodyText || '').trim() || (message.snippet || '').trim() || (language === 'ar' ? '(لا يوجد محتوى واضح)' : '(No clear content)');
    return [
      `${title}:`,
      `${language === 'ar' ? 'الموضوع' : 'Subject'}: ${message.subject || (language === 'ar' ? '(بدون عنوان)' : '(no subject)')}`,
      `${language === 'ar' ? 'من' : 'From'}: ${message.from || '-'}`,
      `${language === 'ar' ? 'إلى' : 'To'}: ${message.to || '-'}`,
      `${language === 'ar' ? 'التاريخ' : 'Date'}: ${message.date || '-'}`,
      `${language === 'ar' ? 'المحتوى' : 'Content'}:`,
      body,
    ].join('\n');
  }).join('\n\n----------------\n\n');
}

const replyToneMap: Record<EmailAiTone, string> = {
  professional: 'professional',
  friendly: 'friendly',
  warm: 'empathetic',
  firm: 'confident',
};

const replyLengthMap: Record<EmailAiLength, string> = {
  short: 'short',
  medium: 'medium',
  detailed: 'long',
};

export function EmailAiAssistant({
  mode,
  language = 'en',
  contextKey,
  message,
  resolveRecentMessages,
  canReply = false,
  onUseAsReply,
  variant = 'panel',
}: EmailAiAssistantProps) {
  const navigate = useNavigate();
  const { loading, error, result, reset, runAction } = useEmailAi();
  const [tone, setTone] = useState<EmailAiTone>('professional');
  const [length, setLength] = useState<EmailAiLength>('medium');
  const [note, setNote] = useState('');
  const [openingTextTool, setOpeningTextTool] = useState(false);
  const [open, setOpen] = useState(false);
  const lang: 'en' | 'ar' = language === 'ar' ? 'ar' : 'en';
  const floatingFieldClass = 'h-9 rounded-xl border border-[#060541]/12 bg-white text-[#060541] shadow-[0_1px_2px_rgba(6,5,65,0.04)] hover:bg-[#f7f8ff] dark:border-white/10 dark:bg-background/80 dark:text-foreground dark:hover:bg-white/5';
  const floatingOutlineButtonClass = 'justify-start gap-2 rounded-xl border border-[#060541]/12 bg-white text-[#060541] shadow-[0_1px_2px_rgba(6,5,65,0.05)] hover:bg-[#f7f8ff] dark:border-white/10 dark:bg-background/70 dark:text-foreground dark:hover:bg-white/5';

  useEffect(() => {
    reset();
    setTone('professional');
    setLength('medium');
    setNote('');
    setOpeningTextTool(false);
    setOpen(false);
  }, [contextKey, reset]);

  const labels = useMemo(() => ({
    title: lang === 'ar' ? 'Wakti Mail AI' : 'Wakti Mail AI',
    subtitle: mode === 'message'
      ? (lang === 'ar' ? 'افهم الرسالة بسرعة، استخرج المطلوب، أو ابدأ الرد.' : 'Understand this email fast, pull what matters, or start the reply.')
      : (lang === 'ar' ? 'احصل على ملخص سريع لآخر الرسائل المهمة.' : 'Get a quick brief for the most recent important emails.'),
    summarize: lang === 'ar' ? 'لخّص هذه الرسالة' : 'Summarize this email',
    briefRecent: lang === 'ar' ? 'لخّص آخر 5 رسائل' : 'Brief last 5 emails',
    tasks: lang === 'ar' ? 'استخرج المهام' : 'Extract tasks',
    deadlines: lang === 'ar' ? 'استخرج المواعيد' : 'Extract deadlines',
    reply: lang === 'ar' ? 'اكتب ردًا' : 'Draft reply',
    tone: lang === 'ar' ? 'النبرة' : 'Tone',
    length: lang === 'ar' ? 'الطول' : 'Length',
    notes: lang === 'ar' ? 'تعليماتك الإضافية' : 'Your extra instructions',
    notesPlaceholder: lang === 'ar' ? 'مثال: اعتذر بلطف، واطلب تأكيد الموعد.' : 'Example: be warm, keep it short, and ask them to confirm the date.',
    copy: lang === 'ar' ? 'نسخ' : 'Copy',
    useInReply: lang === 'ar' ? 'نقله إلى الرد' : 'Move to reply',
    openTextTool: lang === 'ar' ? 'افتحه في مولد النص الذكي' : 'Open in Smart Text Generator',
    result: lang === 'ar' ? 'النتيجة' : 'Result',
    professional: lang === 'ar' ? 'مهني' : 'Professional',
    friendly: lang === 'ar' ? 'ودود' : 'Friendly',
    warm: lang === 'ar' ? 'دافئ' : 'Warm',
    firm: lang === 'ar' ? 'حازم' : 'Firm',
    short: lang === 'ar' ? 'قصير' : 'Short',
    medium: lang === 'ar' ? 'متوسط' : 'Medium',
    detailed: lang === 'ar' ? 'مفصل' : 'Detailed',
  }), [lang, mode]);

  const loadMessages = useCallback(async () => {
    if (mode === 'message') {
      return message ? [message] : [];
    }
    if (!resolveRecentMessages) return [];
    return await resolveRecentMessages();
  }, [message, mode, resolveRecentMessages]);

  const handleAction = useCallback(async (action: EmailAiAction) => {
    try {
      const messages = await loadMessages();
      await runAction({
        action,
        messages,
        language: lang,
        tone,
        length,
        note,
      });
    } catch {}
  }, [lang, length, loadMessages, note, runAction, tone]);

  const handleCopy = useCallback(async () => {
    if (!result?.text) return;
    const copied = await safeCopyToClipboard(result.text);
    if (copied) {
      toast.success(lang === 'ar' ? 'تم نسخ النص' : 'Text copied');
    }
  }, [lang, result?.text]);

  const handleUseAsReply = useCallback(() => {
    if (!result?.text || !onUseAsReply) return;
    onUseAsReply(result.text);
  }, [onUseAsReply, result?.text]);

  const handleOpenInTextTool = useCallback(async () => {
    setOpeningTextTool(true);
    try {
      if (result?.text) {
        saveSmartTextPrefill({
          tab: 'generated',
          generatedText: result.text,
        });
        navigate('/tools/text?tab=generated');
        return;
      }

      const messages = await loadMessages();
      if (!messages.length) {
        toast.error(lang === 'ar' ? 'لا توجد رسالة كافية لإرسالها إلى مولد النص.' : 'There is no email content to send to Smart Text Generator yet.');
        return;
      }

      const combined = formatMessagesForTextTool(messages, lang);
      const trimmedNote = note.trim();

      if (mode === 'message' && canReply) {
        saveSmartTextPrefill({
          tab: 'reply',
          originalMessage: combined,
          keyPoints: trimmedNote,
          tone: replyToneMap[tone],
          replyLength: replyLengthMap[length],
        });
        navigate('/tools/text?tab=reply');
        return;
      }

      const topic = trimmedNote
        ? `${lang === 'ar' ? 'تعليمات المستخدم:' : 'User instructions:'} ${trimmedNote}\n\n${combined}`
        : combined;

      saveSmartTextPrefill({
        tab: 'compose',
        topic,
        tone: mode === 'recent' ? 'informative' : replyToneMap[tone],
        length: replyLengthMap[length],
        contentType: mode === 'recent' ? 'summarize' : 'email',
      });
      navigate('/tools/text?tab=compose');
    } finally {
      setOpeningTextTool(false);
    }
  }, [canReply, lang, length, loadMessages, mode, navigate, note, result?.text, tone]);

  if (variant === 'floating') {
    return (
      <div className="relative">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={labels.title}
              className="group relative flex h-14 w-14 items-center justify-center rounded-[1.15rem] border border-[#060541]/16 bg-[linear-gradient(180deg,#0b0a63_0%,#060541_100%)] text-white shadow-[0_10px_30px_rgba(6,5,65,0.45),0_0_22px_rgba(96,165,250,0.18)] transition-all hover:scale-[1.03] hover:shadow-[0_14px_36px_rgba(6,5,65,0.55),0_0_28px_rgba(96,165,250,0.24)] dark:border-white/15"
            >
              <span className="absolute inset-0 rounded-[1.15rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.22),transparent_62%)] opacity-90" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E9CEB0] text-[#060541] shadow-[0_0_18px_rgba(233,206,176,0.45)]">
                <Sparkles className="h-3 w-3 animate-pulse" />
              </span>
              <span className="absolute -right-1 -top-1 h-5 w-5 animate-ping rounded-full bg-[#E9CEB0]/35" />
              <img src={WAKTI_LOGO_SRC} alt="" className="relative z-10 h-8 w-8 rounded-[0.85rem] object-contain drop-shadow-[0_3px_8px_rgba(0,0,0,0.28)]" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={14} collisionPadding={16} className="w-[min(92vw,340px)] max-h-[min(78vh,38rem)] overflow-hidden rounded-[1.5rem] border border-[#060541]/14 bg-white/98 p-0 text-[#060541] shadow-[0_24px_80px_rgba(6,5,65,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0c0f14]/96 dark:text-foreground dark:shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="max-h-[min(78vh,38rem)] overflow-y-auto overscroll-contain rounded-[1.45rem] border border-[#060541]/10 bg-[linear-gradient(180deg,rgba(6,5,65,0.07),rgba(255,255,255,0.92)_26%,rgba(255,255,255,0.98)_100%)] p-3 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(6,5,65,0.18),rgba(12,15,20,0.96)_38%,rgba(12,15,20,0.98)_100%)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#060541]/12 bg-[linear-gradient(180deg,#0b0a63_0%,#060541_100%)] text-white shadow-[0_0_24px_rgba(96,165,250,0.2)] dark:border-white/10">
                    <img src={WAKTI_LOGO_SRC} alt="" className="h-6 w-6 rounded-xl object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)]" />
                    <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-[#E9CEB0] animate-pulse" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{lang === 'ar' ? 'Wakti AI' : 'Wakti AI'}</div>
                    <div className="text-xs text-muted-foreground">{labels.subtitle}</div>
                  </div>
                </div>
                {(loading || openingTextTool) ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>

              <div className="mt-3 grid gap-2">
                {canReply ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={tone} onValueChange={(value) => setTone(value as EmailAiTone)}>
                      <SelectTrigger className={`${floatingFieldClass} text-xs`}>
                        <SelectValue placeholder={labels.tone} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">{labels.professional}</SelectItem>
                        <SelectItem value="friendly">{labels.friendly}</SelectItem>
                        <SelectItem value="warm">{labels.warm}</SelectItem>
                        <SelectItem value="firm">{labels.firm}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={length} onValueChange={(value) => setLength(value as EmailAiLength)}>
                      <SelectTrigger className={`${floatingFieldClass} text-xs`}>
                        <SelectValue placeholder={labels.length} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">{labels.short}</SelectItem>
                        <SelectItem value="medium">{labels.medium}</SelectItem>
                        <SelectItem value="detailed">{labels.detailed}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={labels.notesPlaceholder} className={`${floatingFieldClass} text-xs`} />

                <div className="grid gap-2">
                  <Button type="button" variant="outline" className={floatingOutlineButtonClass} onClick={() => void handleAction(mode === 'message' ? 'summarize_email' : 'brief_recent')} disabled={loading || openingTextTool}>
                    <FileText className="h-4 w-4" />
                    {mode === 'message' ? labels.summarize : labels.briefRecent}
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" className={floatingOutlineButtonClass} onClick={() => void handleAction('extract_tasks')} disabled={loading || openingTextTool}>
                      <ListTodo className="h-4 w-4" />
                      {labels.tasks}
                    </Button>
                    <Button type="button" variant="outline" className={floatingOutlineButtonClass} onClick={() => void handleAction('extract_deadlines')} disabled={loading || openingTextTool}>
                      <CalendarClock className="h-4 w-4" />
                      {labels.deadlines}
                    </Button>
                  </div>
                  {mode === 'message' && canReply ? (
                    <Button type="button" className="justify-start gap-2 rounded-xl bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={() => void handleAction('draft_reply')} disabled={loading || openingTextTool}>
                      <Reply className="h-4 w-4" />
                      {labels.reply}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" className={floatingOutlineButtonClass} onClick={handleOpenInTextTool} disabled={loading || openingTextTool}>
                    <ArrowUpRight className="h-4 w-4" />
                    {labels.openTextTool}
                  </Button>
                </div>
              </div>

              {error ? (
                <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div className="mt-3 rounded-2xl border border-[#060541]/12 bg-white p-3 text-[#060541] shadow-[0_10px_30px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-card dark:text-card-foreground dark:shadow-sm">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#060541] text-white hover:bg-[#060541]">{result.title}</Badge>
                    <span className="text-xs text-muted-foreground">{labels.result}</span>
                  </div>
                  <Textarea value={result.text} readOnly className="mt-3 min-h-[160px] rounded-xl border border-[#060541]/10 bg-[#fbfbff] text-xs leading-5 text-[#060541] dark:border-white/10 dark:bg-background/80 dark:text-foreground" />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2 rounded-xl border border-[#060541]/12 bg-white text-[#060541] hover:bg-[#f7f8ff] dark:border-white/10 dark:bg-background dark:text-foreground dark:hover:bg-white/5" onClick={() => void handleCopy()}>
                      <Clipboard className="h-4 w-4" />
                      {labels.copy}
                    </Button>
                    {result.action === 'draft_reply' && canReply && onUseAsReply ? (
                      <Button type="button" className="gap-2 rounded-xl bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={handleUseAsReply}>
                        <Reply className="h-4 w-4" />
                        {labels.useInReply}
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="gap-2 rounded-xl border border-[#060541]/12 bg-white text-[#060541] hover:bg-[#f7f8ff] dark:border-white/10 dark:bg-background dark:text-foreground dark:hover:bg-white/5" onClick={handleOpenInTextTool} disabled={openingTextTool}>
                      <ArrowUpRight className="h-4 w-4" />
                      {labels.openTextTool}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#060541] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{labels.title}</div>
              <div className="text-xs text-muted-foreground">{labels.subtitle}</div>
            </div>
          </div>
        </div>
        {(loading || openingTextTool) ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {canReply ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.tone}</div>
            <Select value={tone} onValueChange={(value) => setTone(value as EmailAiTone)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">{labels.professional}</SelectItem>
                <SelectItem value="friendly">{labels.friendly}</SelectItem>
                <SelectItem value="warm">{labels.warm}</SelectItem>
                <SelectItem value="firm">{labels.firm}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.length}</div>
            <Select value={length} onValueChange={(value) => setLength(value as EmailAiLength)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">{labels.short}</SelectItem>
                <SelectItem value="medium">{labels.medium}</SelectItem>
                <SelectItem value="detailed">{labels.detailed}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.notes}</div>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={labels.notesPlaceholder} />
          </div>
        </div>
      ) : mode === 'message' ? (
        <div className="mt-3">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.notes}</div>
          <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={labels.notesPlaceholder} />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void handleAction(mode === 'message' ? 'summarize_email' : 'brief_recent')} disabled={loading || openingTextTool}>
          <FileText className="h-4 w-4" />
          {mode === 'message' ? labels.summarize : labels.briefRecent}
        </Button>
        <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void handleAction('extract_tasks')} disabled={loading || openingTextTool}>
          <ListTodo className="h-4 w-4" />
          {labels.tasks}
        </Button>
        <Button type="button" variant="outline" className="justify-start gap-2" onClick={() => void handleAction('extract_deadlines')} disabled={loading || openingTextTool}>
          <CalendarClock className="h-4 w-4" />
          {labels.deadlines}
        </Button>
        {mode === 'message' && canReply ? (
          <Button type="button" className="justify-start gap-2 bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={() => void handleAction('draft_reply')} disabled={loading || openingTextTool}>
            <Reply className="h-4 w-4" />
            {labels.reply}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="justify-start gap-2" onClick={handleOpenInTextTool} disabled={loading || openingTextTool}>
            <ArrowUpRight className="h-4 w-4" />
            {labels.openTextTool}
          </Button>
        )}
      </div>

      {mode === 'message' && canReply ? (
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="outline" className="gap-2" onClick={handleOpenInTextTool} disabled={loading || openingTextTool}>
            <ArrowUpRight className="h-4 w-4" />
            {labels.openTextTool}
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-3 rounded-2xl border border-border/70 bg-card p-3 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-[#060541] text-white hover:bg-[#060541]">{result.title}</Badge>
              <span className="text-xs text-muted-foreground">{labels.result}</span>
            </div>
          </div>
          <Textarea value={result.text} readOnly className="mt-3 min-h-[180px] bg-background/70 leading-6" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => void handleCopy()}>
              <Clipboard className="h-4 w-4" />
              {labels.copy}
            </Button>
            {result.action === 'draft_reply' && canReply && onUseAsReply ? (
              <Button type="button" className="gap-2 bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={handleUseAsReply}>
                <Reply className="h-4 w-4" />
                {labels.useInReply}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="gap-2" onClick={handleOpenInTextTool} disabled={openingTextTool}>
              <ArrowUpRight className="h-4 w-4" />
              {labels.openTextTool}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
