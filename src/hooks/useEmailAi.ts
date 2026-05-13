import { useCallback, useState } from 'react';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from '@/integrations/supabase/client';

export type EmailAiAction = 'summarize_email' | 'extract_tasks' | 'extract_deadlines' | 'draft_reply' | 'brief_recent';
export type EmailAiTone = 'professional' | 'friendly' | 'warm' | 'firm';
export type EmailAiLength = 'short' | 'medium' | 'detailed';

export interface EmailAiSourceMessage {
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  bodyText: string;
}

export interface EmailAiResult {
  action: EmailAiAction;
  title: string;
  text: string;
}

interface RunEmailAiParams {
  action: EmailAiAction;
  messages: EmailAiSourceMessage[];
  language: string;
  tone?: EmailAiTone;
  length?: EmailAiLength;
  note?: string;
}

const toneMap: Record<EmailAiTone, string> = {
  professional: 'professional',
  friendly: 'friendly',
  warm: 'empathetic',
  firm: 'confident',
};

const lengthMap: Record<EmailAiLength, 'short' | 'medium' | 'long'> = {
  short: 'short',
  medium: 'medium',
  detailed: 'long',
};

const actionTitles = {
  en: {
    summarize_email: 'Email Summary',
    extract_tasks: 'Tasks Found',
    extract_deadlines: 'Deadlines Found',
    draft_reply: 'Reply Draft',
    brief_recent: 'Inbox Brief',
  },
  ar: {
    summarize_email: 'ملخص البريد',
    extract_tasks: 'المهام المستخرجة',
    extract_deadlines: 'المواعيد المستخرجة',
    draft_reply: 'مسودة الرد',
    brief_recent: 'ملخص البريد الوارد',
  },
} as const;

function toBodyText(message: EmailAiSourceMessage, language: 'en' | 'ar') {
  const body = (message.bodyText || '').trim();
  const snippet = (message.snippet || '').trim();
  if (body) return body;
  if (snippet) return snippet;
  return language === 'ar' ? '(لا يوجد محتوى واضح)' : '(No clear content)';
}

function buildMessageContext(messages: EmailAiSourceMessage[], language: 'en' | 'ar') {
  return messages.map((message, index) => {
    const title = messages.length > 1
      ? (language === 'ar' ? `البريد ${index + 1}` : `Email ${index + 1}`)
      : (language === 'ar' ? 'البريد' : 'Email');

    return [
      `${title}:`,
      `${language === 'ar' ? 'الموضوع' : 'Subject'}: ${message.subject || (language === 'ar' ? '(بدون عنوان)' : '(no subject)')}`,
      `${language === 'ar' ? 'من' : 'From'}: ${message.from || '-'}`,
      `${language === 'ar' ? 'إلى' : 'To'}: ${message.to || '-'}`,
      `${language === 'ar' ? 'التاريخ' : 'Date'}: ${message.date || '-'}`,
      `${language === 'ar' ? 'المحتوى' : 'Content'}:`,
      toBodyText(message, language),
    ].join('\n');
  }).join('\n\n----------------\n\n');
}

function buildPrompt({ action, messages, language, tone, length, note }: RunEmailAiParams) {
  const lang: 'en' | 'ar' = language === 'ar' ? 'ar' : 'en';
  const context = buildMessageContext(messages, lang);
  const noteLine = (note || '').trim();
  const toneLine = tone ? toneMap[tone] : 'professional';
  const lengthLine = length ? lengthMap[length] : 'medium';

  if (lang === 'ar') {
    if (action === 'draft_reply') {
      return [
        'أنت مساعد Wakti للبريد.',
        'اكتب فقط نص الرد النهائي الجاهز للإرسال.',
        'لا تضف أي شرح أو عناوين أو ملاحظات خارج نص الرد نفسه.',
        'لا تخترع حقائق أو وعود أو مواعيد أو أسعار أو التزامات غير موجودة في البريد.',
        'إذا كانت هناك معلومة ناقصة، اكتب الرد بشكل مهني واطلب التوضيح بلطف.',
        `النبرة المطلوبة: ${toneLine}`,
        `الطول المطلوب: ${lengthLine}`,
        noteLine ? `تعليمات المستخدم التي يجب مراعاتها: ${noteLine}` : '',
        'هذه هي الرسالة التي سيتم الرد عليها:',
        context,
      ].filter(Boolean).join('\n\n');
    }

    if (action === 'summarize_email') {
      return [
        'أنت مساعد Wakti للبريد.',
        'اقرأ البريد التالي ثم أرجع النتيجة كنص عادي بهذه العناوين فقط:',
        'الملخص:',
        'ماذا يريد المرسل:',
        'درجة الاستعجال:',
        'المهام:',
        'المواعيد:',
        'الخطوة المقترحة التالية:',
        'لا تخترع أي شيء غير موجود. إذا لم توجد معلومة اكتب: غير مذكور.',
        context,
      ].join('\n\n');
    }

    if (action === 'extract_tasks') {
      return [
        'أنت مساعد Wakti للبريد.',
        'استخرج فقط المهام والإجراءات المطلوبة من البريد التالي.',
        'أرجع النتيجة كنص عادي بهذه العناوين فقط:',
        'المهام المباشرة:',
        'متابعات مقترحة:',
        'ما زال يحتاج توضيحاً:',
        'إذا لم توجد مهام واضحة اكتب: لا توجد مهام واضحة.',
        context,
      ].join('\n\n');
    }

    if (action === 'extract_deadlines') {
      return [
        'أنت مساعد Wakti للبريد.',
        'استخرج فقط المواعيد النهائية أو الأوقات أو إشارات الاستعجال من البريد التالي.',
        'أرجع النتيجة كنص عادي بهذه العناوين فقط:',
        'المواعيد الواضحة:',
        'إشارات الاستعجال:',
        'مواعيد غير مكتملة أو تحتاج تأكيداً:',
        'إذا لا يوجد موعد واضح اكتب: لا يوجد موعد واضح.',
        context,
      ].join('\n\n');
    }

    return [
      'أنت مساعد Wakti للبريد.',
      'اقرأ آخر الرسائل التالية وأرجع ملخصاً عملياً للمستخدم.',
      'أرجع النتيجة كنص عادي بهذه العناوين فقط:',
      'ملخص البريد:',
      'يحتاج رداً:',
      'المهام:',
      'المواعيد:',
      'منخفض الأولوية:',
      'الخطوات التالية المقترحة:',
      'لا تخترع معلومات غير موجودة.',
      context,
    ].join('\n\n');
  }

  if (action === 'draft_reply') {
    return [
      'You are Wakti Mail Copilot.',
      'Write only the final reply body that the user can send.',
      'Do not add notes, labels, or explanation outside the reply itself.',
      'Do not invent facts, promises, dates, prices, or commitments that are not in the email.',
      'If key information is missing, keep the reply professional and politely ask for clarification.',
      `Requested tone: ${toneLine}`,
      `Requested length: ${lengthLine}`,
      noteLine ? `User instructions that must be respected: ${noteLine}` : '',
      'Here is the email to reply to:',
      context,
    ].filter(Boolean).join('\n\n');
  }

  if (action === 'summarize_email') {
    return [
      'You are Wakti Mail Copilot.',
      'Read the email below and return plain text with exactly these headings:',
      'Summary:',
      'Sender wants:',
      'Urgency:',
      'Tasks:',
      'Deadlines:',
      'Suggested next step:',
      'Use only facts from the email. If something is missing, say: Not stated.',
      context,
    ].join('\n\n');
  }

  if (action === 'extract_tasks') {
    return [
      'You are Wakti Mail Copilot.',
      'Extract only the tasks and follow-up actions from the email below.',
      'Return plain text with exactly these headings:',
      'Direct tasks:',
      'Suggested follow-up:',
      'Still unclear:',
      'If no task is clear, say: No clear tasks found.',
      context,
    ].join('\n\n');
  }

  if (action === 'extract_deadlines') {
    return [
      'You are Wakti Mail Copilot.',
      'Extract only deadlines, dates, times, and urgency signals from the email below.',
      'Return plain text with exactly these headings:',
      'Clear deadlines:',
      'Urgency signals:',
      'Dates that need confirmation:',
      'If no deadline is clear, say: No clear deadline found.',
      context,
    ].join('\n\n');
  }

  return [
    'You are Wakti Mail Copilot.',
    'Read the recent emails below and create a practical inbox brief for the user.',
    'Return plain text with exactly these headings:',
    'Inbox brief:',
    'Needs reply:',
    'Tasks:',
    'Deadlines:',
    'Low priority:',
    'Suggested next steps:',
    'Do not invent anything that is not in the emails.',
    context,
  ].join('\n\n');
}

async function callTextGenerator(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/text-generator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const responseContentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    if (responseContentType.includes('application/json')) {
      const errorPayload = await response.json().catch(() => ({}));
      throw new Error(errorPayload?.error || 'Failed to generate email AI result');
    }
    throw new Error((await response.text()) || 'Failed to generate email AI result');
  }

  if (responseContentType.includes('application/json')) {
    const jsonPayload = await response.json().catch(() => ({}));
    const cleanJsonText = typeof jsonPayload?.generatedText === 'string' ? jsonPayload.generatedText.trim() : '';
    if (!jsonPayload?.success || !cleanJsonText) {
      throw new Error(jsonPayload?.error || 'Failed to generate email AI result');
    }
    return cleanJsonText;
  }

  if (!response.body) {
    throw new Error('Streaming response not available');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let finalGeneratedText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const events = sseBuffer.split('\n\n');
    sseBuffer = events.pop() || '';

    for (const eventChunk of events) {
      const dataLines = eventChunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .filter(Boolean);

      for (const dataLine of dataLines) {
        const event = JSON.parse(dataLine);
        if (event?.type === 'chunk' && typeof event.text === 'string') {
          finalGeneratedText += event.text;
        }
        if (event?.type === 'complete' && typeof event.generatedText === 'string') {
          finalGeneratedText = event.generatedText;
        }
        if (event?.type === 'error') {
          throw new Error(event?.error || 'Streaming failed');
        }
      }
    }
  }

  const clean = (finalGeneratedText || '').trim();
  if (!clean) {
    throw new Error('Failed to generate email AI result');
  }
  return clean;
}

export function useEmailAi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<EmailAiResult | null>(null);

  const reset = useCallback(() => {
    setError('');
    setResult(null);
    setLoading(false);
  }, []);

  const runAction = useCallback(async ({ action, messages, language, tone, length, note }: RunEmailAiParams) => {
    const lang: 'en' | 'ar' = language === 'ar' ? 'ar' : 'en';
    if (!messages.length) {
      const message = lang === 'ar' ? 'لا توجد رسائل كافية لتحليلها.' : 'There are no email messages to analyze yet.';
      setError(message);
      throw new Error(message);
    }

    setLoading(true);
    setError('');
    try {
      const prompt = buildPrompt({ action, messages, language: lang, tone, length, note });
      const mode = action === 'draft_reply' ? 'reply' : 'compose';
      const generatedText = await callTextGenerator({
        prompt,
        mode,
        language: lang,
        contentType: action === 'draft_reply' ? 'email' : 'summarize',
        tone: tone ? toneMap[tone] : (action === 'draft_reply' ? 'professional' : 'informative'),
        length: mode === 'compose' ? (length ? lengthMap[length] : undefined) : undefined,
        replyLength: mode === 'reply' ? (length ? lengthMap[length] : 'medium') : undefined,
        temperature: action === 'draft_reply' ? 0.65 : 0.35,
      });

      const nextResult: EmailAiResult = {
        action,
        title: actionTitles[lang][action],
        text: generatedText,
      };
      setResult(nextResult);
      return nextResult;
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : 'Email AI failed';
      setError(message);
      throw runError;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    result,
    reset,
    runAction,
  };
}
