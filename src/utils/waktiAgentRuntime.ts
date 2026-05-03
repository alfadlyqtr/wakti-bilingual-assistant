import { Maw3dEvent } from '@/types/maw3d';
import { TRReminder, TRTask } from '@/services/trService';
import { WaktiAgentIntent, WaktiAgentPayload, getWaktiAgentPreset } from '@/utils/waktiAgent';

export interface WaktiAgentCardItem {
  id: string;
  label: string;
  title: string;
  body: string;
  tone: 'cyan' | 'amber' | 'emerald' | 'rose';
  meta?: string[];
}

export interface WaktiAgentWriteDraft {
  id: string;
  kind: 'task' | 'reminder';
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority?: 'normal' | 'high' | 'urgent';
  reason: string;
}

export interface WaktiAgentRunOutput {
  title: string;
  request: string;
  sourceLabel: string;
  found: string[];
  actions: string[];
  result: string;
  cards: WaktiAgentCardItem[];
  drafts: WaktiAgentWriteDraft[];
  approvalLabel: string;
  successLabel: string;
}

interface BuildWaktiAgentRunOptions {
  language: string;
  intent: WaktiAgentIntent;
  source?: string;
  context?: string;
  request: string;
  payload?: WaktiAgentPayload | null;
  tasks: TRTask[];
  reminders: TRReminder[];
  events: Maw3dEvent[];
  attendingCounts?: Record<string, number>;
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, amount: number) {
  const base = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) return dateKey;
  base.setDate(base.getDate() + amount);
  return toDateKey(base);
}

function truncate(text: string, length: number) {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= length) return cleaned;
  return `${cleaned.slice(0, Math.max(0, length - 1)).trim()}…`;
}

function uniqueTexts(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function parseTimeCandidate(input?: string | null) {
  if (!input) return undefined;
  const direct = input.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (direct) return `${direct[1].padStart(2, '0')}:${direct[2]}:00`;

  const meridiem = input.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
  if (!meridiem) return undefined;
  let hour = Number(meridiem[1]);
  const minute = meridiem[2] || '00';
  const mode = meridiem[3].toLowerCase();
  if (mode === 'pm' && hour !== 12) hour += 12;
  if (mode === 'am' && hour === 12) hour = 0;
  return `${`${hour}`.padStart(2, '0')}:${minute}:00`;
}

function parseDateCandidate(input: string, fallbackDate: string) {
  const exact = input.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (exact) return exact[1];

  const lowered = input.toLowerCase();
  if (lowered.includes('tomorrow') || input.includes('غد') || input.includes('بكرة')) {
    return addDays(fallbackDate, 1);
  }
  if (lowered.includes('today') || input.includes('اليوم')) {
    return fallbackDate;
  }
  return fallbackDate;
}

function sanitizeTaskTitle(text: string, language: string) {
  const cleaned = truncate(text.replace(/^[-*•\d.)\s]+/, ''), 80);
  if (!cleaned) return language === 'ar' ? 'متابعة جديدة' : 'New follow-up';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildVoiceCandidates(text: string, language: string) {
  const normalized = text
    .replace(/\r/g, '\n')
    .replace(/[•]+/g, '\n• ')
    .split(/\n+/)
    .flatMap(line => line.split(/[.!?؛]/))
    .map(part => part.trim())
    .filter(part => part.length >= 6 && part.length <= 140);

  const actionHints = language === 'ar'
    ? ['اتصل', 'أرسل', 'ارسل', 'جهز', 'جهّز', 'راجع', 'تابع', 'رتب', 'رتّب', 'احجز', 'اشتري', 'اشتر', 'ادفع', 'سدد', 'ذكر', 'ذكّر', 'تذكير', 'أنشئ', 'انشئ']
    : ['call', 'send', 'prepare', 'review', 'follow', 'book', 'buy', 'pay', 'finish', 'schedule', 'remind', 'create', 'update', 'confirm'];

  const ranked = normalized
    .map(item => ({
      item,
      score: actionHints.reduce((sum, hint) => sum + (item.toLowerCase().includes(hint.toLowerCase()) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || a.item.length - b.item.length)
    .map(entry => entry.item);

  return uniqueTexts(ranked).slice(0, 6);
}

function getUpcomingEvents(events: Maw3dEvent[]) {
  const today = new Date(new Date().toDateString()).getTime();
  return [...events]
    .filter(event => {
      const value = new Date(event.event_date).getTime();
      return Number.isFinite(value) && value >= today;
    })
    .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
}

function getOpenTasks(tasks: TRTask[]) {
  return [...tasks]
    .filter(task => !task.completed)
    .sort((a, b) => {
      const aKey = `${a.due_date || '9999-12-31'} ${a.due_time || '23:59:59'}`;
      const bKey = `${b.due_date || '9999-12-31'} ${b.due_time || '23:59:59'}`;
      return aKey.localeCompare(bKey);
    });
}

function getUpcomingReminders(reminders: TRReminder[]) {
  return [...reminders]
    .sort((a, b) => `${a.due_date} ${a.due_time || '23:59:59'}`.localeCompare(`${b.due_date} ${b.due_time || '23:59:59'}`))
    .slice(0, 4);
}

function buildPlanDayRun(options: BuildWaktiAgentRunOptions): WaktiAgentRunOutput {
  const preset = getWaktiAgentPreset(options.language, options.intent, options.context, options.source);
  const todayKey = toDateKey(new Date());
  const openTasks = getOpenTasks(options.tasks);
  const upcomingEvents = getUpcomingEvents(options.events);
  const upcomingReminders = getUpcomingReminders(options.reminders);
  const topTasks = openTasks.slice(0, 3);
  const focusTitles = topTasks.map(task => task.title);
  const nextEvent = upcomingEvents[0];
  const nextReminder = upcomingReminders[0];

  return {
    title: preset.title,
    request: options.request,
    sourceLabel: preset.sourceLabel,
    found: [
      options.language === 'ar' ? `وجدت ${openTasks.length} مهمة مفتوحة.` : `I found ${openTasks.length} open tasks.`,
      options.language === 'ar' ? `وجدت ${upcomingReminders.length} تذكيرات قريبة.` : `I found ${upcomingReminders.length} near reminders.`,
      nextEvent
        ? (options.language === 'ar' ? `أقرب حدث هو ${nextEvent.title} في ${nextEvent.event_date}.` : `Your next event is ${nextEvent.title} on ${nextEvent.event_date}.`)
        : (options.language === 'ar' ? 'لا يوجد حدث قريب يحتاج التحضير الآن.' : 'There is no upcoming event that needs prep right now.'),
    ],
    actions: focusTitles.length > 0
      ? focusTitles.map(title => options.language === 'ar' ? `ابدأ بـ ${title}` : `Start with ${title}`)
      : preset.actions,
    result: options.language === 'ar'
      ? `الخطة جاهزة لليوم ${todayKey}. لا شيء سيُكتب تلقائيًا.`
      : `Your day plan is ready for ${todayKey}. Nothing will be written automatically.`,
    cards: [
      {
        id: 'focus',
        label: options.language === 'ar' ? 'ابدأ الآن' : 'Start now',
        title: focusTitles[0] || (options.language === 'ar' ? 'يومك تحت السيطرة' : 'Your day is under control'),
        body: focusTitles.length > 0
          ? uniqueTexts(focusTitles).join(options.language === 'ar' ? '، ثم ' : ', then ')
          : (options.language === 'ar' ? 'لا توجد مهام مفتوحة الآن. يمكنك استغلال اليوم في التقدم الهادئ.' : 'You have no open tasks right now, so you can use today for calm progress.'),
        tone: 'cyan',
        meta: topTasks.map(task => `${task.due_date}${task.due_time ? ` • ${task.due_time.slice(0, 5)}` : ''}`),
      },
      {
        id: 'reminders',
        label: options.language === 'ar' ? 'القريب' : 'Coming up',
        title: nextReminder?.title || (options.language === 'ar' ? 'لا تذكيرات ضاغطة' : 'No urgent reminders'),
        body: nextReminder
          ? (options.language === 'ar' ? 'هذا أقرب تذكير يحتاج انتباهك.' : 'This is the nearest reminder that needs attention.')
          : (options.language === 'ar' ? 'لا يوجد شيء ضاغط في التذكيرات القريبة.' : 'Nothing looks urgent in your near reminders.'),
        tone: 'amber',
        meta: nextReminder ? [`${nextReminder.due_date}${nextReminder.due_time ? ` • ${nextReminder.due_time.slice(0, 5)}` : ''}`] : undefined,
      },
      {
        id: 'events',
        label: options.language === 'ar' ? 'الموعد القادم' : 'Next event',
        title: nextEvent?.title || (options.language === 'ar' ? 'لا يوجد موعد قريب' : 'No upcoming event'),
        body: nextEvent
          ? (options.language === 'ar' ? 'أبقِ مساحة للتحضير قبل هذا الموعد.' : 'Keep room in your day to prepare before this event.')
          : (options.language === 'ar' ? 'أيامك القادمة لا تحتوي على موعد قريب.' : 'Your next few days do not include a near event.'),
        tone: 'emerald',
        meta: nextEvent ? [nextEvent.event_date, nextEvent.start_time ? nextEvent.start_time.slice(0, 5) : options.language === 'ar' ? 'بدون وقت' : 'No time'] : undefined,
      },
    ],
    drafts: [],
    approvalLabel: options.language === 'ar' ? 'ثبّت هذه الخطة' : 'Lock this plan',
    successLabel: options.language === 'ar' ? 'تم تثبيت خطة اليوم.' : 'Your day plan is locked in.',
  };
}

function buildVoiceToTasksRun(options: BuildWaktiAgentRunOptions): WaktiAgentRunOutput {
  const preset = getWaktiAgentPreset(options.language, options.intent, options.context, options.source);
  const todayKey = toDateKey(new Date());
  const customRequest = options.request.trim() !== preset.input.trim() ? options.request : '';
  const voiceText = uniqueTexts([
    options.payload?.summary || '',
    options.payload?.transcript || '',
    options.context || '',
    customRequest,
  ]).join('\n');
  const candidates = buildVoiceCandidates(voiceText, options.language);
  const drafts: WaktiAgentWriteDraft[] = candidates.map((candidate, index) => {
    const dueDate = parseDateCandidate(candidate, todayKey);
    const dueTime = parseTimeCandidate(candidate);
    const wantsReminder = /remind|reminder|تذكير|ذكّر|ذكر/i.test(candidate);
    return {
      id: `voice-${index}`,
      kind: wantsReminder ? 'reminder' : 'task',
      title: sanitizeTaskTitle(candidate, options.language),
      description: options.language === 'ar'
        ? `تم إنشاؤه من تسجيل في تسجيل. النص: ${truncate(candidate, 120)}`
        : `Created from a Tasjeel note. Source: ${truncate(candidate, 120)}`,
      dueDate,
      dueTime,
      priority: wantsReminder ? undefined : index === 0 ? 'high' : 'normal',
      reason: options.language === 'ar'
        ? 'استخرجته من النص الحالي بعد مراجعته.'
        : 'I extracted this from your current note after reviewing it.',
    };
  });

  return {
    title: preset.title,
    request: options.request,
    sourceLabel: preset.sourceLabel,
    found: [
      options.language === 'ar'
        ? `راجعت ${voiceText ? 'النص المرسل من تسجيل' : 'السياق الحالي'} واستخرجت ${drafts.length} عناصر.`
        : `I reviewed ${voiceText ? 'the text passed from Tasjeel' : 'your current context'} and extracted ${drafts.length} items.`,
      options.language === 'ar'
        ? (drafts.length > 0 ? 'كل عنصر سيظهر لك قبل الإنشاء.' : 'لم أجد عناصر واضحة بما يكفي للإنشاء.')
        : (drafts.length > 0 ? 'Every item will stay visible before creation.' : 'I did not find clear enough action items to create.'),
      options.language === 'ar'
        ? `المصدر: ${truncate(voiceText || 'لا يوجد نص', 120)}`
        : `Source: ${truncate(voiceText || 'No text was provided', 120)}`,
    ],
    actions: drafts.length > 0
      ? drafts.map(draft => options.language === 'ar' ? `إنشاء ${draft.kind === 'reminder' ? 'تذكير' : 'مهمة'}: ${draft.title}` : `Create ${draft.kind}: ${draft.title}`)
      : preset.actions,
    result: drafts.length > 0
      ? (options.language === 'ar' ? `جاهز لإنشاء ${drafts.length} عناصر بعد موافقتك.` : `Ready to create ${drafts.length} items after your approval.`)
      : (options.language === 'ar' ? 'عدّل الطلب أو راجع النص ثم حاول مرة أخرى.' : 'Edit the request or review the transcript, then try again.'),
    cards: [
      {
        id: 'voice-source',
        label: options.language === 'ar' ? 'النص الحالي' : 'Current note',
        title: drafts.length > 0 ? drafts[0].title : (options.language === 'ar' ? 'لا توجد عناصر واضحة' : 'No clear action items'),
        body: truncate(voiceText || preset.input, 180),
        tone: 'cyan',
      },
      {
        id: 'voice-extract',
        label: options.language === 'ar' ? 'ما التقطته' : 'What I captured',
        title: options.language === 'ar' ? `${drafts.length} عناصر جاهزة` : `${drafts.length} ready items`,
        body: drafts.length > 0
          ? drafts.map(draft => draft.title).join(options.language === 'ar' ? '، ' : ', ')
          : (options.language === 'ar' ? 'أحتاج نصًا أوضح أو طلبًا أضيق.' : 'I need a clearer note or a narrower request.'),
        tone: 'amber',
      },
      {
        id: 'voice-approval',
        label: options.language === 'ar' ? 'بعد الموافقة' : 'After approval',
        title: options.language === 'ar' ? 'سأضيف العناصر التي تختارها فقط' : 'I will only add the items you keep selected',
        body: options.language === 'ar'
          ? 'يمكنك إلغاء أي عنصر قبل الإنشاء. الافتراضي بدون تنفيذ صامت.'
          : 'You can deselect any item before creation. Nothing happens silently.',
        tone: 'emerald',
      },
    ],
    drafts,
    approvalLabel: options.language === 'ar' ? 'أنشئ العناصر المحددة' : 'Create selected items',
    successLabel: options.language === 'ar' ? 'تم إنشاء العناصر المحددة من تسجيل.' : 'The selected items were created from Tasjeel.',
  };
}

function buildPrepareEventRun(options: BuildWaktiAgentRunOptions): WaktiAgentRunOutput {
  const preset = getWaktiAgentPreset(options.language, options.intent, options.context, options.source);
  const todayKey = toDateKey(new Date());
  const upcomingEvents = getUpcomingEvents(options.events);
  const event = options.payload?.eventId
    ? upcomingEvents.find(item => item.id === options.payload?.eventId) || options.events.find(item => item.id === options.payload?.eventId)
    : upcomingEvents[0] || options.events[0];

  if (!event) {
    return {
      title: preset.title,
      request: options.request,
      sourceLabel: preset.sourceLabel,
      found: [
        options.language === 'ar' ? 'لم أجد حدثًا جاهزًا للتحضير الآن.' : 'I could not find an event to prepare right now.',
        options.language === 'ar' ? 'افتح موعد أو أنشئ حدثًا ثم ارجع إلى الوكيل.' : 'Open Maw3d or create an event, then come back to the Agent.',
      ],
      actions: preset.actions,
      result: options.language === 'ar' ? 'لا توجد تغييرات يمكن اقتراحها بدون حدث.' : 'There is nothing safe to propose without an event.',
      cards: [
        {
          id: 'no-event',
          label: options.language === 'ar' ? 'موعد' : 'Event',
          title: options.language === 'ar' ? 'لا يوجد حدث محدد' : 'No event selected',
          body: options.language === 'ar' ? 'سأحتاج حدثًا واحدًا على الأقل كي أبني لك التحضير.' : 'I need at least one event to build a prep plan for you.',
          tone: 'rose',
        },
      ],
      drafts: [],
      approvalLabel: options.language === 'ar' ? 'لا يوجد ما يُنشأ' : 'Nothing to create',
      successLabel: options.language === 'ar' ? 'لا توجد تغييرات.' : 'No changes were made.',
    };
  }

  const prepCandidateDate = addDays(event.event_date, -1);
  const prepDueDate = prepCandidateDate < todayKey ? todayKey : prepCandidateDate;
  const attendeeCount = options.attendingCounts?.[event.id] ?? 0;
  const drafts: WaktiAgentWriteDraft[] = [
    {
      id: `event-task-confirm-${event.id}`,
      kind: 'task',
      title: options.language === 'ar' ? `تأكيد تفاصيل ${event.title}` : `Confirm details for ${event.title}`,
      description: options.language === 'ar'
        ? 'راجع الوقت والموقع والروابط أو المدعوين قبل الحدث.'
        : 'Review the time, location, links, or invitees before the event.',
      dueDate: prepDueDate,
      priority: 'high',
      reason: options.language === 'ar' ? 'هذه خطوة التحضير الأساسية قبل أي حدث.' : 'This is the core prep step before the event.',
    },
    {
      id: `event-task-prepare-${event.id}`,
      kind: 'task',
      title: options.language === 'ar' ? `جهّز ما تحتاجه لـ ${event.title}` : `Prepare what you need for ${event.title}`,
      description: options.language === 'ar'
        ? 'حضّر كل ما يجب حمله أو إرساله أو مراجعته قبل الموعد.'
        : 'Prepare anything you need to bring, send, or review before the event.',
      dueDate: prepDueDate,
      priority: 'normal',
      reason: options.language === 'ar' ? 'لمنع آخر لحظة قبل الحدث.' : 'This reduces last-minute prep before the event.',
    },
  ];

  if (event.start_time) {
    drafts.push({
      id: `event-reminder-${event.id}`,
      kind: 'reminder',
      title: options.language === 'ar' ? `تذكير: ${event.title}` : `Reminder: ${event.title}`,
      description: options.language === 'ar'
        ? 'تذكير بموعد الحدث في وقته المحدد.'
        : 'A reminder for the event at its scheduled time.',
      dueDate: event.event_date,
      dueTime: event.start_time,
      reason: options.language === 'ar' ? 'لإعطائك تذكيرًا واضحًا في وقت الحدث.' : 'This gives you a clear reminder at event time.',
    });
  }

  return {
    title: preset.title,
    request: options.request,
    sourceLabel: preset.sourceLabel,
    found: [
      options.language === 'ar' ? `اخترت الحدث الأقرب: ${event.title}.` : `I selected the nearest event: ${event.title}.`,
      options.language === 'ar'
        ? `التاريخ ${event.event_date}${event.start_time ? ` والوقت ${event.start_time.slice(0, 5)}` : ''}.`
        : `It is on ${event.event_date}${event.start_time ? ` at ${event.start_time.slice(0, 5)}` : ''}.`,
      event.location
        ? (options.language === 'ar' ? `الموقع: ${event.location}.` : `Location: ${event.location}.`)
        : (options.language === 'ar' ? 'لا يوجد موقع محفوظ لهذا الحدث.' : 'This event does not have a saved location.'),
    ],
    actions: drafts.map(draft => options.language === 'ar' ? `${draft.kind === 'reminder' ? 'تذكير' : 'مهمة'}: ${draft.title}` : `${draft.kind === 'reminder' ? 'Reminder' : 'Task'}: ${draft.title}`),
    result: options.language === 'ar'
      ? `جهزت ${drafts.length} اقتراحات تحضير لهذا الحدث.`
      : `I prepared ${drafts.length} prep suggestions for this event.`,
    cards: [
      {
        id: 'event-target',
        label: options.language === 'ar' ? 'الحدث' : 'Event',
        title: event.title,
        body: event.description || (options.language === 'ar' ? 'لا يوجد وصف محفوظ لهذا الحدث.' : 'This event does not have a saved description.'),
        tone: 'cyan',
        meta: uniqueTexts([
          event.event_date,
          event.start_time ? event.start_time.slice(0, 5) : '',
          event.location || '',
        ]),
      },
      {
        id: 'event-attendance',
        label: options.language === 'ar' ? 'الحضور' : 'Attendance',
        title: options.language === 'ar' ? `${attendeeCount} موافقين` : `${attendeeCount} accepted`,
        body: options.language === 'ar'
          ? 'يمكنك استخدام هذا العدد لتقدير التحضير المطلوب.'
          : 'You can use this count to estimate how much prep is needed.',
        tone: 'amber',
      },
      {
        id: 'event-approval',
        label: options.language === 'ar' ? 'بعد الموافقة' : 'After approval',
        title: options.language === 'ar' ? 'سأضيف المهام والتذكيرات المقترحة فقط' : 'I will only add the proposed tasks and reminders',
        body: options.language === 'ar'
          ? 'لن ألمس الحدث نفسه. سأضيف فقط ما توافق عليه في المهام والتذكيرات.'
          : 'I will not change the event itself. I will only add what you approve in Tasks & Reminders.',
        tone: 'emerald',
      },
    ],
    drafts,
    approvalLabel: options.language === 'ar' ? 'أنشئ تحضير هذا الحدث' : 'Create this event prep',
    successLabel: options.language === 'ar' ? 'تم إنشاء عناصر التحضير لهذا الحدث.' : 'The prep items for this event were created.',
  };
}

export function buildWaktiAgentRun(options: BuildWaktiAgentRunOptions): WaktiAgentRunOutput {
  if (options.intent === 'plan-day') return buildPlanDayRun(options);
  if (options.intent === 'voice-to-tasks') return buildVoiceToTasksRun(options);
  if (options.intent === 'prepare-event') return buildPrepareEventRun(options);

  const preset = getWaktiAgentPreset(options.language, options.intent, options.context, options.source);
  return {
    title: preset.title,
    request: options.request,
    sourceLabel: preset.sourceLabel,
    found: preset.found,
    actions: preset.actions,
    result: preset.result,
    cards: preset.found.map((item, index) => ({
      id: `preset-${index}`,
      label: index === 0 ? (options.language === 'ar' ? 'السياق' : 'Context') : (options.language === 'ar' ? 'التالي' : 'Next'),
      title: item,
      body: preset.actions[index] || preset.result,
      tone: index % 3 === 0 ? 'cyan' : index % 3 === 1 ? 'amber' : 'emerald',
    })),
    drafts: [],
    approvalLabel: options.language === 'ar' ? 'موافق' : 'Approve',
    successLabel: options.language === 'ar' ? 'تم حفظ هذا الطلب.' : 'This request is ready.',
  };
}
