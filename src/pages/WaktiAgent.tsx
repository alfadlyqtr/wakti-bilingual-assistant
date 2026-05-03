import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/PageHeader';
import { useTheme } from '@/providers/ThemeProvider';
import { buildWaktiAgentHref, getWaktiAgentPreset, getWaktiAgentQuickActions, readWaktiAgentPayload, WaktiAgentIntent } from '@/utils/waktiAgent';
import { buildWaktiAgentRun, WaktiAgentCardItem, WaktiAgentWriteDraft } from '@/utils/waktiAgentRuntime';
import { useOptimizedTRData } from '@/hooks/useOptimizedTRData';
import { useOptimizedMaw3dEvents } from '@/hooks/useOptimizedMaw3dEvents';
import { TRService } from '@/services/trService';
import { toast } from '@/components/ui/toast-helper';
import { CalendarClock, CheckCircle2, FileAudio, ListTodo, Loader2, PencilLine, Sparkles, XCircle } from 'lucide-react';

function cardToneClass(tone: WaktiAgentCardItem['tone']) {
  if (tone === 'amber') return 'border-[#e9ceb0]/25 bg-[#e9ceb0]/10 text-[#f8ecd9]';
  if (tone === 'emerald') return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50';
  if (tone === 'rose') return 'border-rose-300/20 bg-rose-400/10 text-rose-50';
  return 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50';
}

function draftIcon(kind: WaktiAgentWriteDraft['kind']) {
  return kind === 'reminder' ? <CalendarClock className="h-4 w-4" /> : <ListTodo className="h-4 w-4" />;
}

export default function WaktiAgent() {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent = (searchParams.get('intent') as WaktiAgentIntent | null) || 'ask';
  const source = searchParams.get('source') || undefined;
  const context = searchParams.get('context') || undefined;
  const payloadId = searchParams.get('payload');

  const payload = useMemo(() => readWaktiAgentPayload(payloadId), [payloadId]);
  const preset = useMemo(() => getWaktiAgentPreset(language, intent, context, source), [context, intent, language, source]);
  const quickActions = useMemo(() => getWaktiAgentQuickActions(language), [language]);
  const [request, setRequest] = useState(preset.input);
  const [approved, setApproved] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(new Set());

  const { tasks, reminders, loading: trLoading, error: trError, refresh } = useOptimizedTRData();
  const { events, attendingCounts, loading: eventsLoading, error: eventsError, refetch } = useOptimizedMaw3dEvents();

  useEffect(() => {
    setRequest(preset.input);
    setApproved(false);
  }, [preset]);

  const run = useMemo(() => buildWaktiAgentRun({
    language,
    intent,
    source,
    context,
    request,
    payload,
    tasks,
    reminders,
    events,
    attendingCounts,
  }), [attendingCounts, context, events, intent, language, payload, reminders, request, source, tasks]);

  const draftKey = run.drafts.map(draft => draft.id).join('|');

  useEffect(() => {
    setSelectedDraftIds(new Set(run.drafts.map(draft => draft.id)));
  }, [draftKey]);

  const selectedDrafts = run.drafts.filter(draft => selectedDraftIds.has(draft.id));
  const isContextLoading = (intent === 'plan-day' || intent === 'prepare-event' || intent === 'voice-to-tasks') && (trLoading || eventsLoading);

  const back = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };

  const toggleDraft = (draftId: string) => {
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  };

  const handleApprove = async () => {
    if (run.drafts.length === 0) {
      setApproved(true);
      return;
    }

    if (selectedDrafts.length === 0) {
      toast.error(language === 'ar' ? 'اختر عنصرًا واحدًا على الأقل قبل الإنشاء.' : 'Select at least one item before creating anything.');
      return;
    }

    try {
      setIsApplying(true);
      for (const draft of selectedDrafts) {
        if (draft.kind === 'task') {
          await TRService.createTask({
            title: draft.title,
            description: draft.description,
            due_date: draft.dueDate,
            due_time: draft.dueTime,
            priority: draft.priority || 'normal',
            task_type: 'one-time',
            is_shared: false,
          });
        } else {
          await TRService.createReminder({
            title: draft.title,
            description: draft.description,
            due_date: draft.dueDate,
            due_time: draft.dueTime,
          });
        }
      }
      await Promise.all([refresh(), refetch()]);
      setApproved(true);
      toast.success(run.successLabel);
    } catch (error) {
      console.error('Wakti Agent apply failed:', error);
      toast.error(language === 'ar' ? 'فشل تنفيذ العناصر المحددة.' : 'Failed to apply the selected items.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#0c0f14_0%,rgb(18,24,39)_35%,rgb(13,18,30)_100%)] text-white">
      <PageHeader
        title={run.title}
        Icon={Sparkles}
        colorClass="text-cyan-400"
        subtitle={language === 'ar' ? 'اسأل، خطط، وافق، ثم تحرّك داخل وكتي' : 'Ask, plan, approve, then act inside Wakti'}
        actions={
          <Button variant="outline" onClick={back} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
            {language === 'ar' ? 'رجوع' : 'Back'}
          </Button>
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-10 pt-5 md:px-6">
        <div className="rounded-[1.75rem] border border-white/12 bg-white/5 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-100">
              {run.sourceLabel}
            </span>
            {context ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                {context}
              </span>
            ) : null}
            {payload?.transcript || payload?.summary ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                <FileAudio className="h-3.5 w-3.5" />
                {language === 'ar' ? 'تم إرفاق محتوى حقيقي' : 'Real content attached'}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">
                  {language === 'ar' ? 'ما الذي تريده' : 'What you want'}
                </p>
                <Textarea
                  value={request}
                  onChange={(event) => setRequest(event.target.value)}
                  className="min-h-[120px] border-white/10 bg-black/20 text-white placeholder:text-white/40"
                  placeholder={language === 'ar' ? 'اكتب طلبك هنا...' : 'Type your request here...'}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.intent}
                    type="button"
                    onClick={() => navigate(buildWaktiAgentHref({ intent: action.intent, source: source || 'home' }))}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${action.intent === intent ? 'border-cyan-300/30 bg-cyan-400/12 text-cyan-50' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">{language === 'ar' ? 'مهام مفتوحة' : 'Open tasks'}</p>
                <p className="mt-1 text-2xl font-black text-white">{tasks.filter(task => !task.completed).length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">{language === 'ar' ? 'تذكيرات' : 'Reminders'}</p>
                <p className="mt-1 text-2xl font-black text-white">{reminders.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200/80">{language === 'ar' ? 'أحداث' : 'Events'}</p>
                <p className="mt-1 text-2xl font-black text-white">{events.length}</p>
              </div>
            </div>
          </div>
        </div>

        {isContextLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{language === 'ar' ? 'أراجع بياناتك الحالية داخل وكتي...' : 'I am reviewing your live Wakti data...'}</span>
          </div>
        ) : null}

        {(trError || eventsError) ? (
          <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-50">
            {language === 'ar'
              ? 'هناك جزء من البيانات لم يحمّل بشكل كامل، لكني ما زلت أعرض لك أفضل اقتراح متاح.'
              : 'Part of your live data did not load fully, but I am still showing the best safe proposal I can.'}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          {run.cards.map((card) => (
            <div key={card.id} className={`rounded-[1.5rem] border p-4 backdrop-blur-xl ${cardToneClass(card.tone)}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/75">{card.label}</p>
              <p className="mt-3 text-lg font-black leading-snug text-white">{card.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/80">{card.body}</p>
              {card.meta?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.meta.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-[11px] font-semibold text-white/75">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[1.5rem] border border-white/12 bg-white/5 p-4 backdrop-blur-xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">
              {language === 'ar' ? 'ما وجدته' : 'What I found'}
            </p>
            <div className="space-y-2">
              {run.found.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white/85">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/12 bg-white/5 p-4 backdrop-blur-xl">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">
              {language === 'ar' ? 'ما الذي يمكنني فعله' : 'What I can do'}
            </p>
            <div className="space-y-2">
              {run.actions.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-white/85">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/12 bg-white/5 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200/80">
              {language === 'ar' ? 'العناصر المقترحة' : 'Proposed items'}
            </p>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
              {language === 'ar'
                ? `${selectedDrafts.length} محدد من ${run.drafts.length}`
                : `${selectedDrafts.length} selected of ${run.drafts.length}`}
            </span>
          </div>

          {run.drafts.length > 0 ? (
            <div className="mt-4 space-y-3">
              {run.drafts.map((draft) => {
                const checked = selectedDraftIds.has(draft.id);
                return (
                  <label key={draft.id} className={`flex cursor-pointer gap-3 rounded-2xl border px-3 py-3 transition-all ${checked ? 'border-cyan-300/20 bg-cyan-400/10' : 'border-white/10 bg-black/15'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDraft(draft.id)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-white/85">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
                          {draftIcon(draft.kind)}
                          {draft.kind}
                        </span>
                        <span className="font-black text-white">{draft.title}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/75">{draft.description || draft.reason}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-white/70">
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{draft.dueDate}</span>
                        {draft.dueTime ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{draft.dueTime.slice(0, 5)}</span> : null}
                        {draft.priority ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{draft.priority}</span> : null}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-sm text-white/75">
              {language === 'ar'
                ? 'هذه النتيجة تعتمد على القراءة والتنظيم فقط. لا توجد عناصر إنشاء مطلوبة الآن.'
                : 'This result is planning-only. There are no new items to create right now.'}
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-[#e9ceb0]/20 bg-[linear-gradient(135deg,rgba(6,5,65,0.95)_0%,rgba(18,26,55,0.95)_55%,rgba(6,5,65,0.92)_100%)] p-4 shadow-[0_18px_48px_rgba(6,5,65,0.28)]">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#e9ceb0]">
            {language === 'ar' ? 'الموافقة' : 'Approval'}
          </p>
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm text-white/90">
                {language === 'ar'
                  ? 'لن ينفذ وكتي أي تغيير مهم قبل موافقتك الواضحة.'
                  : 'Wakti will not make important changes before your visible approval.'}
              </p>
              <p className="mt-2 text-sm text-white/65">{run.result}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button onClick={handleApprove} disabled={isApplying || isContextLoading} className="bg-[#e9ceb0] text-[#060541] hover:bg-[#f2dcc4] disabled:opacity-60">
                {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {run.approvalLabel}
              </Button>
              <Button variant="outline" onClick={() => setApproved(false)} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <PencilLine className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'تعديل' : 'Edit'}
              </Button>
              <Button variant="outline" onClick={back} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                <XCircle className="mr-2 h-4 w-4" />
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
            </div>
          </div>
          {approved ? (
            <div className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
              {run.successLabel}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
