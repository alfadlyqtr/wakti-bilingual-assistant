// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, Clock, AlertTriangle, MessageCircle,
  ChevronDown, RefreshCw, Send, BellOff, Loader2, User2
} from 'lucide-react';
import { TRService, TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { useTheme } from '@/providers/ThemeProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, isAfter, parseISO } from 'date-fns';

interface InAppSharedTaskViewerProps {
  shareLink: string;
  onDismiss: () => void;
}

export const InAppSharedTaskViewer: React.FC<InAppSharedTaskViewerProps> = ({
  shareLink,
  onDismiss,
}) => {
  const { language } = useTheme();
  const [task, setTask] = useState<TRTask | null>(null);
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [responses, setResponses] = useState<TRSharedResponse[]>([]);
  const [visitorName, setVisitorName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [comment, setComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [showSnooze, setShowSnooze] = useState(false);
  const [sendingSnooze, setSendingSnooze] = useState(false);
  const [processingSubtask, setProcessingSubtask] = useState<string | null>(null);

  // Get logged-in user's display name from profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, first_name, last_name')
        .eq('id', user.id)
        .single();
      const fullName = [data?.first_name, data?.last_name].filter(Boolean).join(' ');
      const name = data?.display_name || fullName || user.email?.split('@')[0] || 'Wakti User';
      setVisitorName(name);
    });
  }, []);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const t = await TRService.getSharedTask(shareLink);
      if (!t) { toast.error('Task not found or no longer shared'); onDismiss(); return; }
      setTask(t);
      const [subs, resps] = await Promise.all([
        TRSharedService.getTaskSubtasks(t.id),
        TRSharedService.getTaskResponses(t.id),
      ]);
      setSubtasks(subs);
      setResponses(resps);
    } catch {
      toast.error('Failed to load task');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shareLink, onDismiss]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time subscription
  useEffect(() => {
    if (!task) return;
    const channel = TRSharedService.subscribeToTaskUpdates(task.id, () => loadData(true));
    return () => { channel.unsubscribe(); };
  }, [task?.id, loadData]);

  const isSubtaskDoneByMe = (subtaskId: string) =>
    responses.some(r => r.visitor_name === visitorName && r.subtask_id === subtaskId && r.response_type === 'completion' && r.is_completed);

  const handleSubtaskToggle = async (subtask: TRSubtask) => {
    if (!task || !visitorName || processingSubtask) return;
    const isDone = isSubtaskDoneByMe(subtask.id);
    setProcessingSubtask(subtask.id);
    try {
      if (!isDone) {
        await TRSharedService.markSubtaskCompleted(task.id, subtask.id, visitorName, true);
        toast.success(language === 'ar' ? 'تم إنجاز المهمة الفرعية' : 'Subtask completed!');
      } else {
        // Visitor cannot directly uncheck — must request
        await TRSharedService.requestUncheck(task.id, subtask.id, visitorName);
        toast.success(language === 'ar' ? 'تم إرسال طلب الإلغاء' : 'Uncheck request sent to owner');
      }
      await loadData(true);
    } catch {
      toast.error('Action failed');
    } finally {
      setProcessingSubtask(null);
    }
  };

  const handleSendComment = async () => {
    if (!task || !visitorName || !comment.trim()) return;
    setSendingComment(true);
    try {
      await TRSharedService.addComment(task.id, visitorName, comment.trim());
      setComment('');
      toast.success(language === 'ar' ? 'تم إرسال التعليق' : 'Comment sent');
      await loadData(true);
    } catch {
      toast.error('Failed to send comment');
    } finally {
      setSendingComment(false);
    }
  };

  const handleSnoozeRequest = async () => {
    if (!task || !visitorName) return;
    setSendingSnooze(true);
    try {
      await TRSharedService.requestSnooze(task.id, visitorName, snoozeReason.trim() || undefined);
      setSnoozeReason('');
      setShowSnooze(false);
      toast.success(language === 'ar' ? 'تم إرسال طلب التأجيل' : 'Snooze request sent to owner');
    } catch {
      toast.error('Failed to send snooze request');
    } finally {
      setSendingSnooze(false);
    }
  };

  const isOverdue = task && !task.completed && task.due_date &&
    isAfter(new Date(), parseISO(task.due_date));

  const comments = responses.filter(r => r.response_type === 'comment');
  const myPendingSnooze = responses.find(
    r => r.visitor_name === visitorName && r.response_type === 'snooze_request' && !r.content?.includes('"status"')
  );

  if (loading) {
    return (
      <div className="rounded-2xl p-6 flex flex-col items-center gap-3
        bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.09]
        shadow-[0_4px_24px_hsla(0,0%,0%,0.10)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5)]">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
        <p className="text-sm text-muted-foreground/60">
          {language === 'ar' ? 'جارٍ التحميل...' : 'Loading shared task...'}
        </p>
      </div>
    );
  }

  if (!task) return null;

  return (
    <div className="space-y-3">

      {/* ── Banner: you're viewing as a Wakti user ── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl
        bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/70 dark:border-indigo-500/30">
        <User2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        <p className="text-[12px] font-semibold text-indigo-700 dark:text-indigo-300">
          {language === 'ar'
            ? `تتفاعل كـ ${visitorName}`
            : `Interacting as ${visitorName}`}
        </p>
        <button onClick={onDismiss}
          className="ml-auto text-[11px] font-bold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors">
          {language === 'ar' ? 'إغلاق' : 'Dismiss'}
        </button>
      </div>

      {/* ── Task card ── */}
      <div className="rounded-2xl overflow-hidden
        bg-white dark:bg-white/[0.04]
        border border-slate-200 dark:border-white/[0.09]
        shadow-[0_4px_24px_hsla(0,0%,0%,0.10)] dark:shadow-[0_4px_32px_hsla(0,0%,0%,0.5)]">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-[15px] font-bold leading-snug ${task.completed ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                {task.title}
              </p>
              {task.description && (
                <p className="text-[12px] text-muted-foreground/60 mt-1 leading-relaxed">{task.description}</p>
              )}
            </div>
            <button onClick={() => loadData(true)} disabled={refreshing} title="Refresh"
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center
                bg-slate-100 dark:bg-white/[0.06] text-muted-foreground
                hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all active:scale-95 touch-manipulation">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            {task.completed ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {language === 'ar' ? 'مكتملة' : 'Completed'}
              </span>
            ) : isOverdue ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3 w-3" />
                {language === 'ar' ? 'متأخرة' : 'Overdue'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                <Clock className="h-3 w-3" />
                {language === 'ar' ? 'نشطة' : 'Active'}
              </span>
            )}
            {task.due_date && (
              <span className="text-[11px] text-muted-foreground/60">
                {language === 'ar' ? 'موعد:' : 'Due:'} {format(parseISO(task.due_date), 'MMM d, yyyy')}
              </span>
            )}
            {task.priority && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg
                ${task.priority === 'high' ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                  : task.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-slate-100 dark:bg-white/[0.06] text-muted-foreground'}`}>
                {task.priority === 'high' ? (language === 'ar' ? 'عالية' : 'High')
                  : task.priority === 'medium' ? (language === 'ar' ? 'متوسطة' : 'Medium')
                  : (language === 'ar' ? 'منخفضة' : 'Low')}
              </span>
            )}
          </div>
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
            <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2.5">
              {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'} ({subtasks.filter(s => s.completed).length}/{subtasks.length})
            </p>
            <div className="space-y-2">
              {subtasks.map(sub => {
                const doneByMe = isSubtaskDoneByMe(sub.id);
                const doneByOwner = sub.completed;
                const isProcessing = processingSubtask === sub.id;
                return (
                  <button key={sub.id}
                    onClick={() => handleSubtaskToggle(sub)}
                    disabled={isProcessing || task.completed}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left
                      bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06]
                      border border-slate-200/60 dark:border-white/[0.06]
                      disabled:opacity-50 transition-all touch-manipulation active:scale-[0.99]">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                      ${(doneByMe || doneByOwner)
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-slate-300 dark:border-white/20'}`}>
                      {isProcessing
                        ? <Loader2 className="h-3 w-3 text-white animate-spin" />
                        : (doneByMe || doneByOwner) && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className={`text-[13px] font-medium flex-1 min-w-0 truncate
                      ${(doneByMe || doneByOwner) ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                      {sub.title}
                    </span>
                    {doneByOwner && !doneByMe && (
                      <span className="text-[10px] text-emerald-500 font-bold flex-shrink-0">
                        {language === 'ar' ? 'منجزة' : 'Done'}
                      </span>
                    )}
                    {doneByMe && (
                      <span className="text-[10px] text-indigo-500 font-bold flex-shrink-0">
                        {language === 'ar' ? 'أنجزتها' : 'By you'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions row */}
        {!task.completed && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-2 flex-wrap">
            {!myPendingSnooze ? (
              <button onClick={() => setShowSnooze(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold
                  bg-amber-50 dark:bg-amber-500/15 border border-amber-200/70 dark:border-amber-500/30
                  text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/25
                  transition-all touch-manipulation active:scale-95">
                <BellOff className="h-3.5 w-3.5" />
                {language === 'ar' ? 'طلب تأجيل' : 'Request Snooze'}
              </button>
            ) : (
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                {language === 'ar' ? 'طلب التأجيل معلق...' : 'Snooze request pending...'}
              </span>
            )}
          </div>
        )}

        {/* Snooze reason input */}
        {showSnooze && (
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] space-y-2">
            <textarea
              value={snoozeReason}
              onChange={e => setSnoozeReason(e.target.value)}
              placeholder={language === 'ar' ? 'سبب التأجيل (اختياري)...' : 'Reason for snooze (optional)...'}
              rows={2}
              className="w-full text-[13px] rounded-xl px-3 py-2 resize-none
                bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.09]
                text-foreground placeholder:text-muted-foreground/40 outline-none
                focus:border-amber-400 dark:focus:border-amber-500/50 transition-colors"
            />
            <div className="flex items-center gap-2">
              <button onClick={handleSnoozeRequest} disabled={sendingSnooze}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[12px] font-bold
                  bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50
                  transition-all touch-manipulation active:scale-95">
                {sendingSnooze ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {language === 'ar' ? 'إرسال' : 'Send'}
              </button>
              <button onClick={() => setShowSnooze(false)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-bold text-muted-foreground
                  hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all touch-manipulation">
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="px-4 py-3">
          <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2.5">
            {language === 'ar' ? 'التعليقات' : 'Comments'} {comments.length > 0 && `(${comments.length})`}
          </p>

          {comments.length > 0 && (
            <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className={`flex gap-2 ${c.visitor_name === visitorName ? 'flex-row-reverse' : ''}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 bg-indigo-500">
                    {c.visitor_name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`max-w-[75%] ${c.visitor_name === visitorName ? 'items-end' : 'items-start'} flex flex-col`}>
                    <p className="text-[10px] text-muted-foreground/50 mb-0.5">{c.visitor_name}</p>
                    <div className={`px-3 py-2 rounded-xl text-[12px] leading-relaxed
                      ${c.visitor_name === visitorName
                        ? 'bg-indigo-500 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-white/[0.06] text-foreground rounded-tl-sm'}`}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment input */}
          <div className="flex items-end gap-2">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
              placeholder={language === 'ar' ? 'اكتب تعليقاً...' : 'Write a comment...'}
              rows={2}
              className="flex-1 text-[13px] rounded-xl px-3 py-2 resize-none
                bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.09]
                text-foreground placeholder:text-muted-foreground/40 outline-none
                focus:border-indigo-400 dark:focus:border-indigo-500/50 transition-colors"
            />
            <button onClick={handleSendComment} disabled={sendingComment || !comment.trim()}
              className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0
                bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40
                transition-all touch-manipulation active:scale-95">
              {sendingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
