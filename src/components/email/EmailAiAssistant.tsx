import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Sparkles, Clipboard, Reply, ArrowUpRight, ListTodo, CalendarClock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { safeCopyToClipboard } from '@/utils/clipboardUtils';
import { saveSmartTextPrefill } from '@/utils/smartTextPrefill';
import { saveTRPrefill } from '@/utils/trPrefill';
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
  diplomatic: 'diplomatic',
  confident: 'assertive',
  empathetic: 'empathetic',
  concise: 'concise',
};

const replyLengthMap: Record<EmailAiLength, string> = {
  very_short: 'short',
  short: 'short',
  medium: 'medium',
  detailed: 'long',
  comprehensive: 'long',
};

function truncateText(value: string, maxLength = 120) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function cleanInsightText(value: string) {
  return value
    .replace(/^[\s•·\-–—\d.)]+/, '')
    .replace(/[\s.]+$/, '')
    .trim();
}

function extractIsoDate(value: string): string | null {
  const directIso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (directIso) return directIso[1];

  const monthMatch = value.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?\b/i);
  if (!monthMatch) return null;

  const parsed = new Date(monthMatch[0]);
  if (Number.isNaN(parsed.getTime())) return null;

  const month = `${parsed.getMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getDate()}`.padStart(2, '0');
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function extractTime(value: string): string | null {
  const directTime = value.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (directTime) return `${directTime[1].padStart(2, '0')}:${directTime[2]}`;

  const amPm = value.match(/\b(1[0-2]|0?[1-9])\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (!amPm) return null;

  const rawHours = parseInt(amPm[1], 10);
  const isPm = amPm[2].toLowerCase().includes('p');
  const normalizedHours = rawHours % 12 + (isPm ? 12 : 0);
  return `${String(normalizedHours).padStart(2, '0')}:00`;
}

function buildDraftDescription(message: EmailAiSourceMessage | null | undefined, item: string, language: 'en' | 'ar') {
  const lines = [
    message?.subject ? `${language === 'ar' ? 'الموضوع' : 'Subject'}: ${message.subject}` : '',
    message?.from ? `${language === 'ar' ? 'من' : 'From'}: ${message.from}` : '',
    `${language === 'ar' ? 'من ملخص البريد' : 'From email summary'}: ${item}`,
  ].filter(Boolean);

  return lines.join('\n');
}

function buildGroupedTaskDescription(
  message: EmailAiSourceMessage | null | undefined,
  summary: string,
  items: string[],
  language: 'en' | 'ar',
) {
  const lines = [
    message?.subject ? `${language === 'ar' ? 'الموضوع' : 'Subject'}: ${message.subject}` : '',
    message?.from ? `${language === 'ar' ? 'من' : 'From'}: ${message.from}` : '',
    summary ? `${language === 'ar' ? 'الملخص' : 'Summary'}: ${summary}` : '',
    items.length > 0 ? `${language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}:` : '',
    ...items.map((item) => `- ${item}`),
  ].filter(Boolean);

  return lines.join('\n');
}

function getPriorityFromText(values: string[]) {
  return values.some((value) => /\b(urgent|asap|immediately|important|critical|عاجل|فوري|مهم|حرج)\b/i.test(value))
    ? 'high'
    : 'normal';
}

function buildGroupedTaskTitle(params: {
  nextActionText: string;
  senderIntent: string;
  primarySummary: string;
  message?: EmailAiSourceMessage | null;
  taskItems: string[];
  language: 'en' | 'ar';
}) {
  const cleanedTaskItems = params.taskItems.map(cleanInsightText).filter(Boolean);
  const normalizedTaskItems = new Set(cleanedTaskItems.map((item) => item.toLowerCase()));
  const fallbackTitle = params.message?.subject?.trim()
    || (params.language === 'ar' ? 'متابعة البريد' : 'Email follow-up');

  const candidates = [
    params.nextActionText,
    params.senderIntent,
    params.primarySummary,
    params.message?.subject || '',
  ]
    .map(cleanInsightText)
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalizedCandidate = candidate.toLowerCase();
    if (normalizedTaskItems.has(normalizedCandidate) && cleanedTaskItems.length > 1) continue;
    if (candidate.split(/\s+/).length >= 3) return truncateText(candidate);
  }

  if (cleanedTaskItems.length > 1) {
    return truncateText(fallbackTitle);
  }

  return truncateText(cleanedTaskItems[0] || fallbackTitle);
}

interface ParsedEmailAiSection {
  key: string;
  label: string;
  content: string;
}

const resultHeadingMap = {
  en: {
    summarize_email: [
      { key: 'summary', heading: 'Summary:', label: 'Summary' },
      { key: 'senderWants', heading: 'Sender wants:', label: 'Sender wants' },
      { key: 'urgency', heading: 'Urgency:', label: 'Urgency' },
      { key: 'tasks', heading: 'Tasks:', label: 'Tasks' },
      { key: 'deadlines', heading: 'Deadlines:', label: 'Deadlines' },
      { key: 'nextStep', heading: 'Suggested next step:', label: 'Suggested next step' },
    ],
    extract_tasks: [
      { key: 'directTasks', heading: 'Direct tasks:', label: 'Direct tasks' },
      { key: 'followUp', heading: 'Suggested follow-up:', label: 'Suggested follow-up' },
      { key: 'unclear', heading: 'Still unclear:', label: 'Still unclear' },
    ],
    extract_deadlines: [
      { key: 'clearDeadlines', heading: 'Clear deadlines:', label: 'Clear deadlines' },
      { key: 'urgencySignals', heading: 'Urgency signals:', label: 'Urgency signals' },
      { key: 'confirmDates', heading: 'Dates that need confirmation:', label: 'Dates that need confirmation' },
    ],
    brief_recent: [
      { key: 'inboxBrief', heading: 'Inbox brief:', label: 'Inbox brief' },
      { key: 'needsReply', heading: 'Needs reply:', label: 'Needs reply' },
      { key: 'tasks', heading: 'Tasks:', label: 'Tasks' },
      { key: 'deadlines', heading: 'Deadlines:', label: 'Deadlines' },
      { key: 'lowPriority', heading: 'Low priority:', label: 'Low priority' },
      { key: 'nextSteps', heading: 'Suggested next steps:', label: 'Suggested next steps' },
    ],
  },
  ar: {
    summarize_email: [
      { key: 'summary', heading: 'الملخص:', label: 'الملخص' },
      { key: 'senderWants', heading: 'ماذا يريد المرسل:', label: 'ماذا يريد المرسل' },
      { key: 'urgency', heading: 'درجة الاستعجال:', label: 'درجة الاستعجال' },
      { key: 'tasks', heading: 'المهام:', label: 'المهام' },
      { key: 'deadlines', heading: 'المواعيد:', label: 'المواعيد' },
      { key: 'nextStep', heading: 'الخطوة المقترحة التالية:', label: 'الخطوة المقترحة التالية' },
    ],
    extract_tasks: [
      { key: 'directTasks', heading: 'المهام المباشرة:', label: 'المهام المباشرة' },
      { key: 'followUp', heading: 'متابعات مقترحة:', label: 'متابعات مقترحة' },
      { key: 'unclear', heading: 'ما زال يحتاج توضيحاً:', label: 'ما زال يحتاج توضيحاً' },
    ],
    extract_deadlines: [
      { key: 'clearDeadlines', heading: 'المواعيد الواضحة:', label: 'المواعيد الواضحة' },
      { key: 'urgencySignals', heading: 'إشارات الاستعجال:', label: 'إشارات الاستعجال' },
      { key: 'confirmDates', heading: 'مواعيد غير مكتملة أو تحتاج تأكيداً:', label: 'مواعيد تحتاج تأكيداً' },
    ],
    brief_recent: [
      { key: 'inboxBrief', heading: 'ملخص البريد:', label: 'ملخص البريد' },
      { key: 'needsReply', heading: 'يحتاج رداً:', label: 'يحتاج رداً' },
      { key: 'tasks', heading: 'المهام:', label: 'المهام' },
      { key: 'deadlines', heading: 'المواعيد:', label: 'المواعيد' },
      { key: 'lowPriority', heading: 'منخفض الأولوية:', label: 'منخفض الأولوية' },
      { key: 'nextSteps', heading: 'الخطوات التالية المقترحة:', label: 'الخطوات التالية المقترحة' },
    ],
  },
} as const;

function parseEmailAiSections(action: EmailAiAction, text: string, language: 'en' | 'ar'): ParsedEmailAiSection[] {
  if (action === 'draft_reply') return [];
  const specs = resultHeadingMap[language][action as 'summarize_email' | 'extract_tasks' | 'extract_deadlines' | 'brief_recent'];
  if (!specs?.length) return [];

  const buckets = new Map<string, string[]>();
  let currentKey: string | null = null;
  const lines = text.replace(/\r/g, '').split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const spec = specs.find((item) => line.startsWith(item.heading));
    if (spec) {
      currentKey = spec.key;
      const remainder = line.slice(spec.heading.length).trim();
      buckets.set(spec.key, remainder ? [remainder] : []);
      continue;
    }

    if (!currentKey) continue;
    const existing = buckets.get(currentKey) || [];
    existing.push(line);
    buckets.set(currentKey, existing);
  }

  return specs
    .map((spec) => ({
      key: spec.key,
      label: spec.label,
      content: (buckets.get(spec.key) || []).join('\n').trim(),
    }))
    .filter((section) => section.content);
}

function isEmptyInsightValue(value: string, language: 'en' | 'ar') {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;

  const emptyValues = language === 'ar'
    ? ['غير مذكور.', 'غير مذكور', 'لا توجد مهام واضحة.', 'لا يوجد موعد واضح.', 'لا توجد مواعيد واضحة.', 'لا يوجد محتوى واضح.']
    : ['not stated.', 'not stated', 'no clear tasks found.', 'no clear deadline found.', 'no clear content'];

  return emptyValues.includes(normalized);
}

function extractInsightItems(value: string, language: 'en' | 'ar') {
  if (isEmptyInsightValue(value, language)) return [];

  const cleanedLines = value
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim().replace(/^[-•*\d.)\s]+/, ''))
    .filter(Boolean);

  if (cleanedLines.length > 1) {
    return Array.from(new Set(cleanedLines));
  }

  const singleLine = cleanedLines[0] || value.trim();
  const splitRegex = language === 'ar'
    ? /\s*[،؛]\s*|\s+ثم\s+/
    : /\s*[;,]\s*|\s+and\s+/i;

  const items = singleLine
    .split(splitRegex)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 1 ? Array.from(new Set(items)) : [singleLine];
}

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
  const [replySetupOpen, setReplySetupOpen] = useState(false);
  const resultCardRef = useRef<HTMLDivElement | null>(null);
  const shouldRevealReplyResultRef = useRef(false);
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
    setReplySetupOpen(false);
    shouldRevealReplyResultRef.current = false;
  }, [contextKey, reset]);

  useEffect(() => {
    if (result?.action !== 'draft_reply' || !shouldRevealReplyResultRef.current) return;

    const timeoutId = window.setTimeout(() => {
      resultCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      shouldRevealReplyResultRef.current = false;
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [result?.action, result?.text]);

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
    optionalInstruction: lang === 'ar' ? 'تعليمات إضافية اختيارية' : 'Optional instruction',
    optionalInstructionHelper: lang === 'ar' ? 'اكتب هنا شيئًا إضافيًا إذا أردت من الذكاء أن يراعيه في الملخص أو الرد.' : 'Add anything extra you want the AI to respect in the summary or reply.',
    replySetupTitle: lang === 'ar' ? 'إعدادات الرد' : 'Reply settings',
    draftFromHere: lang === 'ar' ? 'اكتب ردًا بهذه الإعدادات' : 'Draft reply with these settings',
    importantThings: lang === 'ar' ? 'أهم النقاط' : 'Important things',
    tasksFound: lang === 'ar' ? 'المهام' : 'Tasks',
    deadlinesFound: lang === 'ar' ? 'المواعيد' : 'Deadlines',
    generateTask: lang === 'ar' ? 'أنشئ مهمة' : 'Generate task',
    generateGroupedTask: lang === 'ar' ? 'أنشئ مهمة رئيسية مع مهام فرعية' : 'Generate grouped task',
    generateSeparateTask: lang === 'ar' ? 'أنشئ كمهمة مستقلة' : 'Generate separate task',
    generateReminder: lang === 'ar' ? 'أنشئ تذكير' : 'Generate reminder',
    taskDraftReady: lang === 'ar' ? 'تم فتح المهمة داخل المهام والتذكيرات' : 'Task draft opened in Tasks & Reminders',
    groupedTaskDraftReady: lang === 'ar' ? 'تم فتح مهمة رئيسية مع مهام فرعية داخل المهام والتذكيرات' : 'Grouped task draft opened in Tasks & Reminders',
    groupedTaskLabel: lang === 'ar' ? 'مهمة رئيسية مقترحة' : 'Suggested main task',
    groupedTaskHelper: lang === 'ar' ? 'لأن هذه العناصر مرتبطة بنفس الهدف، سنحولها إلى مهمة رئيسية واحدة مع مهام فرعية.' : 'These items look related to the same outcome, so Wakti can turn them into one main task with subtasks.',
    reminderDraftReady: lang === 'ar' ? 'تم فتح التذكير داخل المهام والتذكيرات' : 'Reminder draft opened in Tasks & Reminders',
    senderIntent: lang === 'ar' ? 'ماذا يريد المرسل' : 'Sender intent',
    nextAction: lang === 'ar' ? 'الخطوة التالية' : 'Next action',
    urgencyLabel: lang === 'ar' ? 'الاستعجال' : 'Urgency',
    diplomatic: lang === 'ar' ? 'دبلوماسي' : 'Diplomatic',
    confident: lang === 'ar' ? 'واثق' : 'Confident',
    empathetic: lang === 'ar' ? 'متعاطف' : 'Empathetic',
    concise: lang === 'ar' ? 'مقتضب' : 'Concise',
    veryShort: lang === 'ar' ? 'قصير جدًا' : 'Very short',
    comprehensive: lang === 'ar' ? 'شامل' : 'Comprehensive',
    professional: lang === 'ar' ? 'مهني' : 'Professional',
    friendly: lang === 'ar' ? 'ودود' : 'Friendly',
    warm: lang === 'ar' ? 'دافئ' : 'Warm',
    firm: lang === 'ar' ? 'حازم' : 'Firm',
    short: lang === 'ar' ? 'قصير' : 'Short',
    medium: lang === 'ar' ? 'متوسط' : 'Medium',
    detailed: lang === 'ar' ? 'مفصل' : 'Detailed',
  }), [lang, mode]);

  const parsedSections = useMemo(() => {
    if (!result) return [];
    return parseEmailAiSections(result.action, result.text, lang);
  }, [lang, result]);

  const sectionContent = useMemo(() => {
    return parsedSections.reduce<Record<string, string>>((acc, section) => {
      acc[section.key] = section.content;
      return acc;
    }, {});
  }, [parsedSections]);

  const importantItems = useMemo(() => {
    const keys = result?.action === 'brief_recent'
      ? ['needsReply', 'nextSteps']
      : ['senderWants', 'nextStep', 'urgency'];
    return Array.from(new Set(keys.flatMap((key) => extractInsightItems(sectionContent[key] || '', lang))));
  }, [lang, result?.action, sectionContent]);

  const taskItems = useMemo(() => {
    const keys = result?.action === 'extract_tasks'
      ? ['directTasks', 'followUp']
      : ['tasks'];
    return Array.from(new Set(keys.flatMap((key) => extractInsightItems(sectionContent[key] || '', lang))));
  }, [lang, result?.action, sectionContent]);

  const deadlineItems = useMemo(() => {
    const keys = result?.action === 'extract_deadlines'
      ? ['clearDeadlines', 'urgencySignals', 'confirmDates']
      : ['deadlines'];
    return Array.from(new Set(keys.flatMap((key) => extractInsightItems(sectionContent[key] || '', lang))));
  }, [lang, result?.action, sectionContent]);

  const primarySummary = sectionContent.summary || sectionContent.inboxBrief || '';
  const senderIntent = sectionContent.senderWants || sectionContent.needsReply || '';
  const urgencyText = sectionContent.urgency || sectionContent.urgencySignals || '';
  const nextActionText = sectionContent.nextStep || sectionContent.nextSteps || sectionContent.followUp || '';
  const hasStructuredResult = Boolean(result && result.action !== 'draft_reply' && parsedSections.length > 0);
  const cleanedTaskItems = useMemo(() => Array.from(new Set(taskItems.map(cleanInsightText).filter(Boolean))), [taskItems]);
  const canCreateGroupedTask = cleanedTaskItems.length > 1;
  const groupedTaskTitle = useMemo(() => buildGroupedTaskTitle({
    nextActionText,
    senderIntent,
    primarySummary,
    message,
    taskItems: cleanedTaskItems,
    language: lang,
  }), [cleanedTaskItems, lang, message, nextActionText, primarySummary, senderIntent]);

  const loadMessages = useCallback(async () => {
    if (mode === 'message') {
      return message ? [message] : [];
    }
    if (!resolveRecentMessages) return [];
    return await resolveRecentMessages();
  }, [message, mode, resolveRecentMessages]);

  const handleAction = useCallback(async (action: EmailAiAction) => {
    if (action !== 'draft_reply') {
      shouldRevealReplyResultRef.current = false;
      setReplySetupOpen(false);
    } else {
      shouldRevealReplyResultRef.current = true;
    }
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
      if (action === 'draft_reply') {
        setReplySetupOpen(false);
      }
    } catch {
      if (action === 'draft_reply') {
        shouldRevealReplyResultRef.current = false;
      }
    }
  }, [lang, length, loadMessages, note, runAction, tone]);

  const handleStartReplyFlow = useCallback(() => {
    setReplySetupOpen(true);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result?.text) return;
    const copied = await safeCopyToClipboard(result.text);
    if (copied) {
      toast.success(lang === 'ar' ? 'تم نسخ النص' : 'Text copied');
    }
  }, [lang, result?.text]);

  const handleUseAsReply = useCallback(() => {
    if (!result?.text || !onUseAsReply) return;
    setReplySetupOpen(false);
    setOpen(false);
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

  const handleCreateTaskDraft = useCallback((item: string) => {
    const cleanedItem = cleanInsightText(item);
    if (!cleanedItem) return;

    saveTRPrefill({
      version: 1,
      kind: 'task',
      openTab: 'tasks',
      openModal: 'create',
      draft: {
        title: cleanedItem,
        description: buildDraftDescription(message, cleanedItem, lang),
        due_date: extractIsoDate(cleanedItem),
        due_time: extractTime(cleanedItem),
        priority: /\b(urgent|asap|immediately|important|عاجل|فوري|مهم)\b/i.test(cleanedItem) ? 'high' : 'normal',
        task_type: 'one-time',
        is_shared: false,
      },
      source: {
        type: 'email_ai',
        action: result?.action === 'draft_reply' ? undefined : result?.action,
        contextKey,
        emailSubject: message?.subject,
        emailFrom: message?.from,
        rawItemText: item,
      },
    });

    navigate('/tr?tab=tasks&intent=create');
    toast.success(labels.taskDraftReady);
  }, [contextKey, labels.taskDraftReady, lang, message, navigate, result?.action]);

  const handleCreateGroupedTaskDraft = useCallback(() => {
    if (cleanedTaskItems.length === 0) return;

    const candidateSources = [groupedTaskTitle, nextActionText, senderIntent, ...deadlineItems, ...importantItems];
    const dueDate = candidateSources.map(extractIsoDate).find(Boolean) || null;
    const dueTime = candidateSources.map(extractTime).find(Boolean) || null;
    const titleLower = groupedTaskTitle.trim().toLowerCase();
    const subtasks = cleanedTaskItems
      .filter((item) => item.toLowerCase() !== titleLower)
      .map((item) => ({ title: item }));

    saveTRPrefill({
      version: 1,
      kind: 'task',
      openTab: 'tasks',
      openModal: 'create',
      draft: {
        title: groupedTaskTitle,
        description: buildGroupedTaskDescription(message, primarySummary, cleanedTaskItems, lang),
        due_date: dueDate,
        due_time: dueTime,
        priority: getPriorityFromText([urgencyText, nextActionText, ...deadlineItems, ...cleanedTaskItems]),
        task_type: 'one-time',
        is_shared: false,
        subtasks,
      },
      source: {
        type: 'email_ai',
        action: result?.action === 'draft_reply' ? undefined : result?.action,
        contextKey,
        emailSubject: message?.subject,
        emailFrom: message?.from,
        rawItemText: cleanedTaskItems.join('\n'),
      },
    });

    navigate('/tr?tab=tasks&intent=create');
    toast.success(labels.groupedTaskDraftReady);
  }, [cleanedTaskItems, contextKey, deadlineItems, groupedTaskTitle, importantItems, lang, labels.groupedTaskDraftReady, message, navigate, nextActionText, primarySummary, result?.action, senderIntent, urgencyText]);

  const handleCreateReminderDraft = useCallback((item: string) => {
    const cleanedItem = cleanInsightText(item);
    if (!cleanedItem) return;

    const dueDate = extractIsoDate(cleanedItem);
    const dueTime = extractTime(cleanedItem);

    saveTRPrefill({
      version: 1,
      kind: 'reminder',
      openTab: 'reminders',
      openModal: 'create',
      draft: {
        title: cleanedItem,
        description: buildDraftDescription(message, cleanedItem, lang),
        due_date: dueDate,
        due_time: dueTime,
      },
      source: {
        type: 'email_ai',
        action: result?.action === 'draft_reply' ? undefined : result?.action,
        contextKey,
        emailSubject: message?.subject,
        emailFrom: message?.from,
        rawItemText: item,
      },
      missing: [
        ...(dueDate ? [] : ['due_date' as const]),
        ...(dueTime ? [] : ['due_time' as const]),
      ],
      needsConfirmation: !dueDate || !dueTime,
    });

    navigate('/tr?tab=reminders&intent=create');
    toast.success(labels.reminderDraftReady);
  }, [contextKey, labels.reminderDraftReady, lang, message, navigate, result?.action]);

  if (variant === 'floating') {
    return (
      <div className="relative">
        <Dialog open={open} onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setReplySetupOpen(false);
          }
        }}>
          <DialogTrigger asChild>
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
          </DialogTrigger>
          <DialogContent
            title={labels.title}
            description={labels.subtitle}
            className="w-[min(96vw,720px)] max-w-[720px] overflow-hidden rounded-[2rem] border border-[#060541]/14 bg-white/95 p-0 text-[#060541] shadow-[0_36px_120px_rgba(6,5,65,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0c0f14]/96 dark:text-foreground dark:shadow-[0_36px_120px_rgba(0,0,0,0.6)]"
            overlayClassName="fixed inset-0 z-[1000] bg-[rgba(5,8,18,0.62)] backdrop-blur-md"
          >
            <div className="max-h-[min(86vh,52rem)] overflow-y-auto overscroll-contain rounded-[1.95rem] border border-[#060541]/10 bg-[linear-gradient(180deg,rgba(6,5,65,0.12),rgba(255,255,255,0.96)_20%,rgba(255,255,255,0.99)_100%)] p-4 sm:p-5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,20,40,0.95),rgba(12,15,20,0.98)_28%,rgba(12,15,20,1)_100%)]">
              <div className="flex items-start justify-between gap-3 pr-8">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-[1.35rem] border border-[#060541]/12 bg-[linear-gradient(180deg,#0b0a63_0%,#060541_100%)] text-white shadow-[0_0_30px_rgba(96,165,250,0.24)] dark:border-white/10">
                    <img src={WAKTI_LOGO_SRC} alt="" className="h-7 w-7 rounded-xl object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.28)]" />
                    <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-[#E9CEB0] animate-pulse" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">{lang === 'ar' ? 'Wakti AI' : 'Wakti AI'}</div>
                    <div className="max-w-[460px] text-sm leading-6 text-muted-foreground">{labels.subtitle}</div>
                  </div>
                </div>
                {(loading || openingTextTool) ? <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted-foreground" /> : null}
              </div>

              <div className="mt-4 grid gap-3">
                <div className="grid gap-3">
                  <Button type="button" variant="outline" className={`${floatingOutlineButtonClass} h-12 text-base`} onClick={() => void handleAction(mode === 'message' ? 'summarize_email' : 'brief_recent')} disabled={loading || openingTextTool}>
                    <FileText className="h-4 w-4" />
                    {mode === 'message' ? labels.summarize : labels.briefRecent}
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button type="button" variant="outline" className={`${floatingOutlineButtonClass} h-12 text-base`} onClick={() => void handleAction('extract_tasks')} disabled={loading || openingTextTool}>
                      <ListTodo className="h-4 w-4" />
                      {labels.tasks}
                    </Button>
                    <Button type="button" variant="outline" className={`${floatingOutlineButtonClass} h-12 text-base`} onClick={() => void handleAction('extract_deadlines')} disabled={loading || openingTextTool}>
                      <CalendarClock className="h-4 w-4" />
                      {labels.deadlines}
                    </Button>
                  </div>
                  {mode === 'message' && canReply ? (
                    <Button type="button" className="h-12 justify-start gap-2 rounded-2xl bg-[#060541] text-base text-white shadow-[0_12px_28px_rgba(6,5,65,0.3)] hover:bg-[#0a0a5c]" onClick={handleStartReplyFlow} disabled={loading || openingTextTool}>
                      <Reply className="h-4 w-4" />
                      {labels.reply}
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" className={`${floatingOutlineButtonClass} h-12 text-base`} onClick={handleOpenInTextTool} disabled={loading || openingTextTool}>
                    <ArrowUpRight className="h-4 w-4" />
                    {labels.openTextTool}
                  </Button>
                </div>

                {replySetupOpen && canReply ? (
                  <div className="rounded-[1.45rem] border border-[#060541]/10 bg-white/70 p-3 shadow-[0_10px_28px_rgba(6,5,65,0.05)] dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.replySetupTitle}</div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Select value={tone} onValueChange={(value) => setTone(value as EmailAiTone)}>
                        <SelectTrigger className={`${floatingFieldClass} h-11 text-sm`}>
                          <SelectValue placeholder={labels.tone} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">{labels.professional}</SelectItem>
                          <SelectItem value="friendly">{labels.friendly}</SelectItem>
                          <SelectItem value="warm">{labels.warm}</SelectItem>
                          <SelectItem value="firm">{labels.firm}</SelectItem>
                          <SelectItem value="diplomatic">{labels.diplomatic}</SelectItem>
                          <SelectItem value="confident">{labels.confident}</SelectItem>
                          <SelectItem value="empathetic">{labels.empathetic}</SelectItem>
                          <SelectItem value="concise">{labels.concise}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={length} onValueChange={(value) => setLength(value as EmailAiLength)}>
                        <SelectTrigger className={`${floatingFieldClass} h-11 text-sm`}>
                          <SelectValue placeholder={labels.length} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="very_short">{labels.veryShort}</SelectItem>
                          <SelectItem value="short">{labels.short}</SelectItem>
                          <SelectItem value="medium">{labels.medium}</SelectItem>
                          <SelectItem value="detailed">{labels.detailed}</SelectItem>
                          <SelectItem value="comprehensive">{labels.comprehensive}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.optionalInstruction}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{labels.optionalInstructionHelper}</div>
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder={labels.notesPlaceholder} className="mt-3 min-h-[92px] rounded-2xl border border-[#060541]/12 bg-white text-sm leading-6 text-[#060541] shadow-[0_1px_2px_rgba(6,5,65,0.04)] dark:border-white/10 dark:bg-background/80 dark:text-foreground" />

                    <Button type="button" className="mt-3 h-11 w-full justify-center gap-2 rounded-2xl bg-[#060541] text-sm text-white shadow-[0_12px_28px_rgba(6,5,65,0.3)] hover:bg-[#0a0a5c]" onClick={() => void handleAction('draft_reply')} disabled={loading || openingTextTool}>
                      <Reply className="h-4 w-4" />
                      {labels.draftFromHere}
                    </Button>
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-500">
                  {error}
                </div>
              ) : null}

              {result ? (
                <div ref={resultCardRef} className="mt-4 rounded-[1.6rem] border border-[#060541]/12 bg-white p-4 text-[#060541] shadow-[0_12px_36px_rgba(6,5,65,0.08)] dark:border-white/10 dark:bg-card dark:text-card-foreground dark:shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[#060541] text-white hover:bg-[#060541]">{result.title}</Badge>
                    <span className="text-xs text-muted-foreground">{labels.result}</span>
                  </div>
                  {hasStructuredResult ? (
                    <div className="mt-4 space-y-4">
                      {primarySummary ? (
                        <div className="rounded-[1.4rem] border border-[#060541]/10 bg-[linear-gradient(180deg,rgba(245,247,255,1),rgba(255,255,255,0.96))] p-4 shadow-[0_8px_20px_rgba(6,5,65,0.05)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,20,29,0.9),rgba(10,12,18,0.94))]">
                          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{result.title}</div>
                          <div className="mt-2 text-sm leading-7 text-foreground">{primarySummary}</div>
                        </div>
                      ) : null}

                      {(senderIntent || urgencyText || nextActionText) ? (
                        <div className="grid gap-3 sm:grid-cols-3">
                          {senderIntent ? (
                            <div className="rounded-[1.25rem] border border-[#060541]/10 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.senderIntent}</div>
                              <div className="mt-2 text-sm leading-6 text-foreground">{senderIntent}</div>
                            </div>
                          ) : null}
                          {urgencyText ? (
                            <div className="rounded-[1.25rem] border border-amber-500/20 bg-amber-50/60 p-3 dark:border-amber-400/20 dark:bg-amber-500/10">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">{labels.urgencyLabel}</div>
                              <div className="mt-2 text-sm leading-6 text-foreground">{urgencyText}</div>
                            </div>
                          ) : null}
                          {nextActionText ? (
                            <div className="rounded-[1.25rem] border border-blue-500/20 bg-blue-50/70 p-3 dark:border-blue-400/20 dark:bg-blue-500/10">
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-300">{labels.nextAction}</div>
                              <div className="mt-2 text-sm leading-6 text-foreground">{nextActionText}</div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {(importantItems.length > 0 || taskItems.length > 0 || deadlineItems.length > 0) ? (
                        <div className="rounded-[1.35rem] border border-[#060541]/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                          {importantItems.length > 0 ? (
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.importantThings}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {importantItems.map((item) => (
                                  <Badge key={`important-${item}`} className="rounded-full border border-[#060541]/12 bg-[#eef2ff] px-3 py-1 text-[11px] font-medium text-[#060541] hover:bg-[#eef2ff] dark:border-white/10 dark:bg-white/10 dark:text-foreground">{item}</Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {taskItems.length > 0 ? (
                            <div className={importantItems.length > 0 ? 'mt-4' : ''}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.tasksFound}</div>
                              {canCreateGroupedTask ? (
                                <div className="mt-2 rounded-2xl border border-emerald-500/15 bg-emerald-50/80 px-3 py-3 dark:border-emerald-400/15 dark:bg-emerald-500/10">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">{labels.groupedTaskLabel}</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge className="rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">{groupedTaskTitle}</Badge>
                                  </div>
                                  <div className="mt-2 text-xs leading-5 text-emerald-800/90 dark:text-emerald-200/90">{labels.groupedTaskHelper}</div>
                                  <Button type="button" size="sm" className="mt-3 h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#0c0f14] dark:hover:bg-emerald-400" onClick={handleCreateGroupedTaskDraft}>
                                    <ListTodo className="h-4 w-4" />
                                    {labels.generateGroupedTask}
                                  </Button>
                                </div>
                              ) : null}
                              <div className="mt-2 grid gap-2">
                                {taskItems.map((item) => (
                                  <div key={`task-${item}`} className="flex flex-col gap-2 rounded-2xl border border-emerald-500/15 bg-emerald-50/70 px-3 py-3 dark:border-emerald-400/15 dark:bg-emerald-500/10 sm:flex-row sm:items-center sm:justify-between">
                                    <Badge className="w-fit rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300">{item}</Badge>
                                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl border-emerald-500/20 bg-white/90 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-background/70 dark:text-emerald-300 dark:hover:bg-emerald-500/10" onClick={() => handleCreateTaskDraft(item)}>
                                      <ListTodo className="h-3.5 w-3.5" />
                                      {canCreateGroupedTask ? labels.generateSeparateTask : labels.generateTask}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {deadlineItems.length > 0 ? (
                            <div className={importantItems.length > 0 || taskItems.length > 0 ? 'mt-4' : ''}>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{labels.deadlinesFound}</div>
                              <div className="mt-2 grid gap-2">
                                {deadlineItems.map((item) => (
                                  <div key={`deadline-${item}`} className="flex flex-col gap-2 rounded-2xl border border-amber-500/15 bg-amber-50/70 px-3 py-3 dark:border-amber-400/15 dark:bg-amber-500/10 sm:flex-row sm:items-center sm:justify-between">
                                    <Badge className="w-fit rounded-full border border-amber-500/20 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300">{item}</Badge>
                                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl border-amber-500/20 bg-white/90 text-amber-700 hover:bg-amber-50 dark:border-amber-400/20 dark:bg-background/70 dark:text-amber-300 dark:hover:bg-amber-500/10" onClick={() => handleCreateReminderDraft(item)}>
                                      <CalendarClock className="h-3.5 w-3.5" />
                                      {labels.generateReminder}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <Textarea value={result.text} readOnly className="mt-3 min-h-[220px] rounded-2xl border border-[#060541]/10 bg-[#fbfbff] text-sm leading-6 text-[#060541] dark:border-white/10 dark:bg-background/80 dark:text-foreground" />
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="gap-2 rounded-xl border border-[#060541]/12 bg-white text-[#060541] hover:bg-[#f7f8ff] dark:border-white/10 dark:bg-background dark:text-foreground dark:hover:bg-white/5" onClick={() => void handleCopy()}>
                      <Clipboard className="h-4 w-4" />
                      {labels.copy}
                    </Button>
                    {result.action !== 'draft_reply' && canReply ? (
                      <Button type="button" className="gap-2 rounded-xl bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={handleStartReplyFlow} disabled={loading || openingTextTool}>
                        <Reply className="h-4 w-4" />
                        {labels.reply}
                      </Button>
                    ) : null}
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
          </DialogContent>
        </Dialog>
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

      {!canReply && mode === 'message' ? (
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
          <Button type="button" className="justify-start gap-2 bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={handleStartReplyFlow} disabled={loading || openingTextTool}>
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

      {replySetupOpen && canReply ? (
        <div className="mt-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.replySetupTitle}</div>
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
                  <SelectItem value="diplomatic">{labels.diplomatic}</SelectItem>
                  <SelectItem value="confident">{labels.confident}</SelectItem>
                  <SelectItem value="empathetic">{labels.empathetic}</SelectItem>
                  <SelectItem value="concise">{labels.concise}</SelectItem>
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
                  <SelectItem value="very_short">{labels.veryShort}</SelectItem>
                  <SelectItem value="short">{labels.short}</SelectItem>
                  <SelectItem value="medium">{labels.medium}</SelectItem>
                  <SelectItem value="detailed">{labels.detailed}</SelectItem>
                  <SelectItem value="comprehensive">{labels.comprehensive}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.optionalInstruction}</div>
              <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder={labels.notesPlaceholder} />
            </div>
          </div>
          <Button type="button" className="mt-3 gap-2 bg-[#060541] text-white hover:bg-[#0a0a5c]" onClick={() => void handleAction('draft_reply')} disabled={loading || openingTextTool}>
            <Reply className="h-4 w-4" />
            {labels.draftFromHere}
          </Button>
        </div>
      ) : null}

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
        <div ref={resultCardRef} className="mt-3 rounded-2xl border border-border/70 bg-card p-3 text-card-foreground shadow-sm">
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
