export type WaktiAgentIntent = 'ask' | 'plan-day' | 'voice-to-tasks' | 'prepare-event' | 'project-next-steps' | 'continue';

const WAKTI_AGENT_PAYLOAD_PREFIX = 'wakti-agent-payload:';

export interface WaktiAgentUrlOptions {
  intent?: WaktiAgentIntent;
  source?: string;
  context?: string;
  payloadId?: string;
}

export interface WaktiAgentPayload {
  transcript?: string;
  summary?: string;
  eventId?: string;
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
}

interface WaktiAgentPreset {
  title: string;
  input: string;
  sourceLabel: string;
  found: string[];
  actions: string[];
  result: string;
}

export function getWaktiAgentSourceLabel(language: string, source?: string) {
  const labels: Record<string, { en: string; ar: string }> = {
    home: { en: 'Home', ar: 'الرئيسية' },
    maw3d: { en: 'Maw3d', ar: 'موعد' },
    tasjeel: { en: 'Tasjeel', ar: 'تسجيل' },
    voice: { en: 'Voice', ar: 'صوت' },
    projects: { en: 'Projects', ar: 'المشاريع' },
    wakti_ai: { en: 'Wakti AI', ar: 'Wakti AI' },
  };
  if (!source) return language === 'ar' ? 'داخل وكتي' : 'Inside Wakti';
  return language === 'ar' ? (labels[source]?.ar || 'داخل وكتي') : (labels[source]?.en || 'Inside Wakti');
}

export function stashWaktiAgentPayload(payload: WaktiAgentPayload) {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(`${WAKTI_AGENT_PAYLOAD_PREFIX}${id}`, JSON.stringify(payload));
  }
  return id;
}

export function readWaktiAgentPayload(payloadId?: string | null) {
  if (!payloadId || typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(`${WAKTI_AGENT_PAYLOAD_PREFIX}${payloadId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as WaktiAgentPayload : null;
  } catch {
    return null;
  }
}

export function clearWaktiAgentPayload(payloadId?: string | null) {
  if (!payloadId || typeof window === 'undefined') return;
  window.sessionStorage.removeItem(`${WAKTI_AGENT_PAYLOAD_PREFIX}${payloadId}`);
}

export function buildWaktiAgentHref({ intent = 'ask', source, context, payloadId }: WaktiAgentUrlOptions = {}) {
  const params = new URLSearchParams();
  params.set('intent', intent);
  if (source) params.set('source', source);
  if (context) params.set('context', context);
  if (payloadId) params.set('payload', payloadId);
  const query = params.toString();
  return query ? `/wakti-agent?${query}` : '/wakti-agent';
}

export function getWaktiAgentQuickActions(language: string) {
  return [
    { intent: 'plan-day' as const, label: language === 'ar' ? 'خطط ليومي' : 'Plan my day' },
    { intent: 'voice-to-tasks' as const, label: language === 'ar' ? 'حوّل الصوت إلى مهام' : 'Turn voice note into tasks' },
    { intent: 'prepare-event' as const, label: language === 'ar' ? 'جهّز هذا الحدث' : 'Prepare this event' },
    { intent: 'project-next-steps' as const, label: language === 'ar' ? 'الخطوات التالية للمشروع' : 'Give me next steps' },
  ];
}

export function getWaktiAgentPreset(language: string, intent: WaktiAgentIntent = 'ask', context?: string, source?: string): WaktiAgentPreset {
  const sourceText = getWaktiAgentSourceLabel(language, source);
  const contextText = context?.trim();

  if (intent === 'plan-day') {
    return {
      title: language === 'ar' ? 'خطط ليومي' : 'Plan my day',
      input: language === 'ar' ? 'خطط ليومي اعتمادًا على مهامي وتذكيراتي وأحداثي.' : 'Plan my day using my tasks, reminders, and events.',
      sourceLabel: sourceText,
      found: language === 'ar'
        ? [
            'سأراجع مهامك المفتوحة وتذكيراتك القريبة.',
            'سأرتب ما يحتاج انتباه الآن.',
            contextText ? `السياق الحالي: ${contextText}` : 'يمكنني البدء من شاشتك الرئيسية.'
          ]
        : [
            'I will review your open tasks and near reminders.',
            'I will surface what needs attention now.',
            contextText ? `Current context: ${contextText}` : 'I can start from your home screen context.'
          ],
      actions: language === 'ar'
        ? ['اقتراح أولويات اليوم.', 'تنظيم ما هو متأخر أو قريب.', 'تجهيز خطة بسيطة يمكنك اعتمادها.']
        : ['Suggest today’s priorities.', 'Organize what is overdue or close.', 'Prepare a simple plan you can approve.'],
      result: language === 'ar' ? 'عند التنفيذ، سيعيد وكتي ترتيب يومك بشكل واضح وآمن.' : 'Once live execution is connected, Wakti will turn this into a clear, safe day plan.'
    };
  }

  if (intent === 'voice-to-tasks') {
    return {
      title: language === 'ar' ? 'حوّل الصوت إلى مهام' : 'Turn voice note into tasks',
      input: language === 'ar' ? 'حوّل هذا التسجيل أو النص إلى مهام واضحة وتذكيرات إذا لزم.' : 'Turn this recording or transcript into clear tasks and reminders if needed.',
      sourceLabel: sourceText,
      found: language === 'ar'
        ? [
            'سأقرأ النص أو الملخص الحالي.',
            'سألتقط العناصر القابلة للتنفيذ.',
            contextText ? `السياق الحالي: ${contextText}` : 'يمكنني العمل من تسجيلك الحالي.'
          ]
        : [
            'I will read the current transcript or summary.',
            'I will extract the actionable items.',
            contextText ? `Current context: ${contextText}` : 'I can work from your current recording.'
          ],
      actions: language === 'ar'
        ? ['اقتراح مهام رئيسية.', 'اقتراح تذكيرات مرتبطة بالنص.', 'إعداد خطة موافقة قبل الإنشاء.']
        : ['Suggest main tasks.', 'Suggest reminder candidates from the note.', 'Prepare an approval plan before anything is created.'],
      result: language === 'ar' ? 'عند تفعيل التنفيذ، سيحوّل وكتي هذه الملاحظات إلى أفعال داخل النظام.' : 'Once execution is enabled, Wakti will turn this captured context into real actions inside the system.'
    };
  }

  if (intent === 'prepare-event') {
    return {
      title: language === 'ar' ? 'جهّز هذا الحدث' : 'Prepare this event',
      input: language === 'ar' ? 'جهّز هذا الحدث وأنشئ ما يلزم من تذكيرات وخطوات تحضيرية.' : 'Prepare this event and create the right reminders and prep steps.',
      sourceLabel: sourceText,
      found: language === 'ar'
        ? [
            'سأراجع بيانات الحدث الحالية.',
            'سأتحقق من التذكيرات والتحضير الناقص.',
            contextText ? `السياق الحالي: ${contextText}` : 'يمكنني البدء من صفحة الموعد الحالية.'
          ]
        : [
            'I will review the current event details.',
            'I will check for missing reminders and prep items.',
            contextText ? `Current context: ${contextText}` : 'I can start from the current Maw3d page.'
          ],
      actions: language === 'ar'
        ? ['اقتراح تذكيرين أو أكثر.', 'إنشاء قائمة تحضير قصيرة.', 'تجهيز متابعة بعد الحدث إذا احتجت.']
        : ['Suggest one or more reminders.', 'Create a short prep checklist.', 'Prepare a follow-up step if needed.'],
      result: language === 'ar' ? 'عند تفعيل التنفيذ، سيحوّل وكتي هذا الحدث إلى خطة تحضير واضحة.' : 'Once execution is enabled, Wakti will turn this event into a clear prep plan.'
    };
  }

  if (intent === 'project-next-steps') {
    return {
      title: language === 'ar' ? 'الخطوات التالية للمشروع' : 'Give me next steps for this project',
      input: language === 'ar' ? 'اقرأ المشروع الحالي واقترح لي الخطوات التالية العملية.' : 'Read the current project and suggest the most practical next steps.',
      sourceLabel: sourceText,
      found: language === 'ar'
        ? [
            'سأقرأ حالة المشروع الحالية.',
            'سألتقط ما يمكن تحويله إلى خطوات قصيرة.',
            contextText ? `السياق الحالي: ${contextText}` : 'يمكنني البدء من المشروع الحالي.'
          ]
        : [
            'I will read the current project state.',
            'I will turn that into short next-step options.',
            contextText ? `Current context: ${contextText}` : 'I can start from the current project context.'
          ],
      actions: language === 'ar'
        ? ['اقتراح 3 خطوات تالية.', 'ترتيبها حسب الأولوية.', 'تحويلها إلى مهام عند الموافقة.']
        : ['Suggest 3 practical next steps.', 'Order them by priority.', 'Turn them into tasks when you approve.'],
      result: language === 'ar' ? 'عند تفعيل التنفيذ، سيحوّل وكتي هذا إلى تقدم فعلي في المشروع.' : 'Once execution is enabled, Wakti will turn this into real project progress.'
    };
  }

  if (intent === 'continue') {
    return {
      title: language === 'ar' ? 'تابع آخر شيء' : 'Continue last thing',
      input: language === 'ar' ? 'ساعدني على متابعة آخر شيء كنت أعمل عليه داخل وكتي.' : 'Help me continue the last thing I was working on inside Wakti.',
      sourceLabel: sourceText,
      found: language === 'ar'
        ? [
            'سأبحث عن آخر سياق واضح داخل وكتي.',
            'سأعرض ما يمكن استكماله الآن.',
            contextText ? `السياق الحالي: ${contextText}` : 'يمكنني البدء من آخر نشاط معروف.'
          ]
        : [
            'I will look for the last meaningful context inside Wakti.',
            'I will show what can be continued now.',
            contextText ? `Current context: ${contextText}` : 'I can start from your last known activity.'
          ],
      actions: language === 'ar'
        ? ['اقتراح الاستكمال الأنسب.', 'إعادة فتح السياق المناسب.', 'تجهيز الخطوة التالية للموافقة.']
        : ['Suggest the best continuation path.', 'Return to the right context.', 'Prepare the next step for approval.'],
      result: language === 'ar' ? 'هذا يمهّد لوكيل وكتي أن يربط رحلتك داخل التطبيق بشكل طبيعي.' : 'This sets Wakti Agent up to connect your in-app journey naturally.'
    };
  }

  return {
    title: language === 'ar' ? 'اسأل وكتي' : 'Ask Wakti',
    input: language === 'ar' ? 'ساعدني داخل وكتي خطوة بخطوة.' : 'Help me inside Wakti, step by step.',
    sourceLabel: sourceText,
    found: language === 'ar'
      ? [
          'سأبدأ من الصفحة أو السياق الحالي.',
          'سأعرض ما وجدته قبل أي إجراء.',
          contextText ? `السياق الحالي: ${contextText}` : 'يمكنني البدء من داخل وكتي مباشرة.'
        ]
      : [
          'I will start from your current page or context.',
          'I will show what I found before any action happens.',
          contextText ? `Current context: ${contextText}` : 'I can begin directly from inside Wakti.'
        ],
    actions: language === 'ar'
      ? ['اقتراح خطة واضحة.', 'طلب موافقتك قبل أي تغيير مهم.', 'إرجاع النتيجة لك بشكل مفهوم.']
      : ['Propose a clear plan.', 'Ask for approval before important changes.', 'Report the result back clearly.'],
    result: language === 'ar' ? 'هذه هي واجهة وكتي الأساسية للطلب والتخطيط والموافقة والتنفيذ.' : 'This is the core Wakti Agent shell for asking, planning, approving, and acting.'
  };
}
