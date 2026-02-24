// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Hash, Loader2, Clock, AlertTriangle,
  X, Check, UserPlus, Link2, Copy, CheckCircle, MessageCircle, ChevronDown, Send
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TRTask } from '@/services/trService';
import { TRSharedService } from '@/services/trSharedService';
import { ActivityMonitor } from './ActivityMonitor';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Assignment {
  id: string;
  task_id: string;
  assignee_id: string;
  assignee_name: string;
  status: 'pending' | 'approved' | 'denied';
  requested_at: string;
  responded_at: string | null;
  task?: { id: string; title: string; share_link: string; task_code: string | null; completed: boolean; due_date: string | null; priority: string | null; user_id: string; };
}

interface SharedTasksTabProps {
  tasks: TRTask[];
  onTasksChanged: () => void;
  incomingShareLink?: string | null;
}

// ── Assignee tabbed card (mirrors owner's ActivityMonitor card, no Approvals tab) ──
const AssignedTaskCard: React.FC<{ assignment: Assignment; language: string }> = ({ assignment, language }) => {
  // Always use assignment.task_id directly — never rely on the join which may be null
  const taskId = assignment.task_id;
  const [taskMeta, setTaskMeta] = useState<{ share_link: string; user_id: string; title: string } | null>(null);
  const shareLink = taskMeta?.share_link || (assignment.task as any)?.share_link;
  const [activeTab, setActiveTab] = useState<'subtasks' | 'people' | 'chat' | 'log' | 'requests'>('subtasks');
  const [subtaskTab, setSubtaskTab] = useState<'pending' | 'completed'>('pending');
  const [pendingOpen, setPendingOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [subtasks, setSubtasks] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [ownerName, setOwnerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  // Snooze request state
  const [snoozeSubtask, setSnoozeSubtask] = useState<{ id: string; title: string } | null>(null); // null = main task
  // Mark all pending subtasks as completed at once
  const handleMarkAllDone = async () => {
    const pending = subtasks.filter(s => !s.completed);
    if (pending.length === 0) return;
    
    // Optimistic update
    setSubtasks(prev => prev.map(s => 
      pending.some(p => p.id === s.id) ? { ...s, completed: true } : s
    ));
    
    try {
      await Promise.all(
        pending.map(subtask => 
          TRSharedService.markSubtaskCompleted(taskId, subtask.id, visitorName, true)
        )
      );
      toast.success(
        language === 'ar' ? `تم إنجاز ${pending.length} مهام فرعية` : `${pending.length} subtasks marked done`,
        { duration: 2000 }
      );
    } catch (error) {
      // Revert
      setSubtasks(prev => prev.map(s => 
        pending.some(p => p.id === s.id) ? { ...s, completed: false } : s
      ));
      toast.error(language === 'ar' ? 'فشل تحديث بعض المهام' : 'Failed to update some subtasks', { duration: 2000 });
    }
  };

  // Assignee requests task completion (requires owner approval)
  const handleRequestTaskCompletion = async () => {
    try {
      await TRSharedService.requestTaskCompletion(taskId, visitorName);
      toast.success(
        language === 'ar' ? 'تم إرسال طلب إكمال المهمة للمالك' : 'Completion request sent to owner',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Error requesting task completion:', error);
      toast.error(language === 'ar' ? 'فشل إرسال الطلب' : 'Failed to send request', { duration: 2000 });
    }
  };
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [snoozeReason, setSnoozeReason] = useState('');
  const [sendingSnooze, setSendingSnooze] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    // Get current user's display name
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data: p } = await supabase.from('profiles').select('display_name,first_name,last_name').eq('id', user.id).single();
        const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ');
        setVisitorName(p?.display_name || full || assignment.assignee_name);
      }
    });
    const load = async () => {
      setLoading(true);
      // Fetch task meta, subtasks, and responses in parallel
      const [{ data: taskData }, { data: st }, { data: rs }] = await Promise.all([
        supabase.from('tr_tasks').select('id,share_link,user_id,title').eq('id', taskId).single(),
        supabase.from('tr_subtasks').select('id,title,completed').eq('task_id', taskId).order('order_index'),
        supabase.from('tr_shared_responses').select('*').eq('task_id', taskId).order('created_at'),
      ]);
      if (taskData) {
        setTaskMeta(taskData);
        // Fetch owner name
        const { data: ownerProfile } = await supabase.from('profiles').select('display_name,first_name,last_name').eq('id', taskData.user_id).single();
        if (ownerProfile) {
          const full = [ownerProfile.first_name, ownerProfile.last_name].filter(Boolean).join(' ');
          setOwnerName(ownerProfile.display_name || full || 'Owner');
        }
      }
      setSubtasks(st || []);
      setResponses(rs || []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`assigned-card-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_subtasks', filter: `task_id=eq.${taskId}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_shared_responses', filter: `task_id=eq.${taskId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId]);

  const comments = responses.filter(r => r.response_type === 'comment');
  const activityLog = responses.filter(r => r.response_type !== 'comment');
  const activityPeople = [...new Set(responses.map(r => r.visitor_name).filter(Boolean))];
  const completedCount = subtasks.filter(s => s.completed).length;

  const sendSnoozeRequest = async (targetSubtask: { id: string; title: string } | null) => {
    if (!snoozeDate || !taskId || !shareLink) { toast.error(language === 'ar' ? 'اختر تاريخاً' : 'Pick a date first'); return; }
    setSendingSnooze(true);
    try {
      const snoozeUntil = snoozeTime ? `${snoozeDate}T${snoozeTime}` : `${snoozeDate}T00:00`;
      const targetLabel = targetSubtask ? targetSubtask.title : (language === 'ar' ? 'المهمة الرئيسية' : 'Main task');
      const content = JSON.stringify({ snooze_until: snoozeUntil, reason: snoozeReason.trim() || null, target_label: targetLabel });
      await supabase.from('tr_shared_responses').insert({
        task_id: taskId, share_link: shareLink,
        visitor_name: visitorName || assignment.assignee_name,
        response_type: 'snooze_request', content,
        subtask_id: targetSubtask ? targetSubtask.id : null,
        is_completed: false,
      });
      toast.success(language === 'ar' ? 'تم إرسال طلب التأجيل' : 'Snooze request sent!');
      setSnoozeDate(''); setSnoozeTime(''); setSnoozeReason(''); setSnoozeSubtask(null);
    } catch { toast.error('Failed'); } finally { setSendingSnooze(false); }
  };

  const sendComment = async () => {
    if (!commentText.trim() || !taskId || !shareLink) return;
    setSendingComment(true);
    try {
      await supabase.from('tr_shared_responses').insert({
        task_id: taskId, share_link: shareLink,
        visitor_name: visitorName || assignment.assignee_name,
        response_type: 'comment', content: commentText.trim(), is_completed: false,
      });
      setCommentText('');
    } catch { toast.error('Failed to send'); } finally { setSendingComment(false); }
  };

  const tabs = [
    { key: 'subtasks', icon: <CheckCircle className="h-3 w-3" />, label: language === 'ar' ? 'المهام' : 'Tasks', badge: subtasks.length > 0 ? `${completedCount}/${subtasks.length}` : null, activeBg: 'bg-emerald-500', activeShadow: 'shadow-[0_2px_8px_hsla(142,76%,45%,0.4)]' },
    { key: 'people', icon: <Users className="h-3 w-3" />, label: language === 'ar' ? 'الأشخاص' : 'People', badge: null, activeBg: 'bg-[#060541] dark:bg-blue-600', activeShadow: 'shadow-[0_2px_8px_hsla(243,84%,14%,0.4)]' },
    { key: 'chat', icon: <MessageCircle className="h-3 w-3" />, label: language === 'ar' ? 'دردشة' : 'Chat', badge: comments.length > 0 ? String(comments.length) : null, activeBg: 'bg-sky-500', activeShadow: 'shadow-[0_2px_8px_hsla(199,89%,48%,0.4)]' },
    { key: 'requests', icon: <AlertTriangle className="h-3 w-3" />, label: language === 'ar' ? 'طلبات' : 'Request', badge: null, activeBg: 'bg-orange-500', activeShadow: 'shadow-[0_2px_8px_hsla(25,95%,55%,0.4)]' },
    { key: 'log', icon: <Clock className="h-3 w-3" />, label: language === 'ar' ? 'السجل' : 'Log', badge: null, activeBg: 'bg-slate-700 dark:bg-slate-500', activeShadow: 'shadow-[0_2px_8px_hsla(0,0%,0%,0.3)]' },
  ];

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-indigo-400" /></div>;

  return (
    <div className="space-y-0">
      {/* Tab bar */}
      <div className="flex items-stretch gap-1 px-1 py-2.5 border-t border-slate-100 dark:border-white/[0.06]">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[48px] px-1 py-1.5 rounded-xl text-[10px] font-bold
                transition-all touch-manipulation active:scale-95
                ${ isActive
                  ? `${tab.activeBg} text-white ${tab.activeShadow}`
                  : 'bg-white dark:bg-white/[0.08] border-2 border-slate-300 dark:border-white/[0.15] text-slate-700 dark:text-slate-200 hover:border-slate-400 shadow-[0_1px_4px_hsla(0,0%,0%,0.1)]'
                }`}>
              <span className="flex-shrink-0">{tab.icon}</span>
              <span className="leading-tight text-center">{tab.label}</span>
              {tab.badge && (
                <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                  ${isActive ? 'bg-white/30 text-white' : 'bg-slate-200 dark:bg-white/[0.2] text-slate-700 dark:text-slate-200'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 pb-4 px-1">

        {/* SUBTASKS tab */}
        {activeTab === 'subtasks' && (
          <div className="space-y-3 pt-1">
            {/* Action buttons */}
            {subtasks.filter(s => !s.completed).length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={handleMarkAllDone}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                    bg-emerald-500 hover:bg-emerald-600 text-white
                    text-[12px] font-bold transition-all active:scale-[0.98] touch-manipulation">
                  <Check className="h-4 w-4" />
                  {language === 'ar' ? 'تحديد الكل كمكتمل' : 'Mark All Done'}
                </button>
                <button
                  onClick={handleRequestTaskCompletion}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                    bg-amber-500 hover:bg-amber-600 text-white
                    text-[12px] font-bold transition-all active:scale-[0.98] touch-manipulation">
                  <AlertTriangle className="h-4 w-4" />
                  {language === 'ar' ? 'طلب إكمال المهمة' : 'Request Task Completion'}
                </button>
              </div>
            )}

            {/* Subtask tabs */}
            <div className="flex gap-3 px-1">
              <button onClick={() => setSubtaskTab('pending')}
                className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5
                  ${subtaskTab === 'pending' ? 'text-indigo-600 dark:text-indigo-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
                <div className={`w-1 h-3 rounded-full ${subtaskTab === 'pending' ? 'bg-indigo-500' : 'bg-muted-foreground/20'}`} />
                {language === 'ar' ? 'قيد الانتظار' : 'Pending'} ({subtasks.filter(s => !s.completed).length})
              </button>
              <button onClick={() => setSubtaskTab('completed')}
                className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5
                  ${subtaskTab === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}>
                <div className={`w-1 h-3 rounded-full ${subtaskTab === 'completed' ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`} />
                {language === 'ar' ? 'مكتمل' : 'Completed'} ({subtasks.filter(s => s.completed).length})
              </button>
            </div>

            {/* Pending subtasks */}
            {subtaskTab === 'pending' && (
              <div className="space-y-1.5">
                <button onClick={() => setPendingOpen(!pendingOpen)}
                  className="w-full flex items-center gap-2 px-1 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`h-3 w-3 transition-transform ${pendingOpen ? 'rotate-0' : '-rotate-90'}`} />
                  {language === 'ar' ? 'المهام المعلقة' : 'Pending Tasks'}
                </button>
                <div className={`space-y-1.5 overflow-hidden transition-all ${pendingOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  {subtasks.filter(st => !st.completed).length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد مهام معلقة' : 'No pending tasks'}</p>
                  ) : subtasks.filter(st => !st.completed).map(st => (
                    <div key={st.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-white/20 flex items-center justify-center" />
                      <p className="text-[12px] font-semibold flex-1 text-foreground" dir="auto">{st.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed subtasks */}
            {subtaskTab === 'completed' && (
              <div className="space-y-1.5">
                <button onClick={() => setCompletedOpen(!completedOpen)}
                  className="w-full flex items-center gap-2 px-1 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`h-3 w-3 transition-transform ${completedOpen ? 'rotate-0' : '-rotate-90'}`} />
                  {language === 'ar' ? 'المهام المكتملة' : 'Completed Tasks'}
                </button>
                <div className={`space-y-1.5 overflow-hidden transition-all ${completedOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  {subtasks.filter(st => st.completed).length === 0 ? (
                    <p className="text-center py-4 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد مهام مكتملة' : 'No completed tasks'}</p>
                  ) : subtasks.filter(st => st.completed).map(st => (
                    <div key={st.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-white/20 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      </div>
                      <p className="text-[12px] font-semibold flex-1 line-through text-muted-foreground/60" dir="auto">{st.title}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PEOPLE tab */}
        {activeTab === 'people' && (
          <div className="space-y-2 pt-1">
            {/* Owner row */}
            {ownerName && (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/60 dark:border-indigo-500/20">
                <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-[13px] font-black text-white flex-shrink-0">
                  {ownerName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-bold text-foreground truncate" dir="auto">{ownerName}</p>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-200 dark:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
                      {language === 'ar' ? 'المالك' : 'Owner'}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50">{language === 'ar' ? 'مالك المهمة' : 'Task owner'}</p>
                </div>
              </div>
            )}
            {/* Activity people */}
            {activityPeople.length === 0 && !ownerName ? (
              <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
            ) : activityPeople.map(name => {
              const acts = responses.filter(r => r.visitor_name === name);
              const last = acts.length > 0 ? [...acts].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] : null;
              return (
                <div key={name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.07]">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/[0.1] flex items-center justify-center text-[13px] font-black text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate" dir="auto">{name}</p>
                    <p className="text-[10px] text-muted-foreground/50">{last ? format(parseISO(last.created_at), 'MMM dd, HH:mm') : '—'}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CHAT tab */}
        {activeTab === 'chat' && (
          <div className="space-y-2 pt-1">
            {comments.length === 0 ? (
              <p className="text-center py-4 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {[...comments].sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map(c => (
                  <div key={c.id} className="rounded-xl p-3 bg-slate-50 dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 dark:text-purple-400 flex-shrink-0">
                        {c.visitor_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[12px] font-bold text-foreground" dir="auto">{c.visitor_name}</span>
                      <span className="text-[10px] text-muted-foreground/50 ml-auto">{format(parseISO(c.created_at), 'MMM dd, HH:mm')}</span>
                    </div>
                    <div className="bg-white dark:bg-white/[0.04] rounded-lg px-3 py-2 text-[13px] text-foreground border border-slate-200/50 dark:border-white/[0.06]" dir="auto">{c.content}</div>
                  </div>
                ))}
              </div>
            )}
            {/* Comment input */}
            <div className="flex gap-2 pt-1">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
                placeholder={language === 'ar' ? 'اكتب تعليقاً...' : 'Write a comment...'}
                className="flex-1 px-3 py-2 rounded-xl text-[13px] bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                dir="auto"
              />
              <button onClick={sendComment} disabled={!commentText.trim() || sendingComment}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 transition-all active:scale-95 flex-shrink-0">
                {sendingComment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* REQUESTS tab */}
        {activeTab === 'requests' && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 px-1 pb-1">
              <div className="w-1 h-4 rounded-full bg-orange-500" />
              <p className="text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                {language === 'ar' ? 'طلب تأجيل' : 'Request a Snooze'}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/70 px-1">
              {language === 'ar' ? 'اختر المهمة أو المهمة الفرعية التي تريد تأجيلها:' : 'Pick what you want to snooze, then set a date:'}
            </p>

            {/* Step 1: Pick target — Main task + collapsible subtasks */}
            <div className="space-y-1.5">
              {/* Main task card */}
              <button
                onClick={() => setSnoozeSubtask(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95
                  ${ snoozeSubtask === null
                    ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500'
                    : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.07] hover:border-orange-300' }`}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ snoozeSubtask === null ? 'border-orange-500 bg-orange-500' : 'border-slate-300 dark:border-white/20' }`}>
                  {snoozeSubtask === null && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
                <span className={`text-[13px] font-bold ${ snoozeSubtask === null ? 'text-orange-700 dark:text-orange-300' : 'text-foreground' }`}>
                  {language === 'ar' ? 'المهمة الرئيسية' : 'Main task'}
                </span>
              </button>
              {/* Subtasks section */}
              <div className="relative">
                <button
                  onClick={() => setSubtasksOpen(!subtasksOpen)}
                  className="w-full flex items-center gap-2 px-1 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDown className={`h-3 w-3 transition-transform ${subtasksOpen ? 'rotate-0' : '-rotate-90'}`} />
                  {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'} ({subtasks.length})
                </button>
                {/* Subtask cards */}
                <div className={`space-y-1.5 overflow-hidden transition-all ${subtasksOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                  {subtasks.map(st => (
                    <button key={st.id}
                      onClick={() => setSnoozeSubtask({ id: st.id, title: st.title })}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 text-left transition-all active:scale-95
                        ${ snoozeSubtask?.id === st.id
                          ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-400 dark:border-orange-500'
                          : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.07] hover:border-orange-300' }`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ snoozeSubtask?.id === st.id ? 'border-orange-500 bg-orange-500' : 'border-slate-300 dark:border-white/20' }`}>
                        {snoozeSubtask?.id === st.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      <span className={`text-[13px] font-semibold flex-1 truncate ${ snoozeSubtask?.id === st.id ? 'text-orange-700 dark:text-orange-300' : 'text-foreground' }`} dir="auto">{st.title}</span>
                      {st.completed && <Check className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Date + Time */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground px-1">{language === 'ar' ? 'التاريخ *' : 'Date *'}</p>
                <input type="date" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[13px] bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-foreground focus:outline-none focus:border-orange-400 transition-colors" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground px-1">{language === 'ar' ? 'الوقت' : 'Time'}</p>
                <input type="time" value={snoozeTime} onChange={e => setSnoozeTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-[13px] bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-foreground focus:outline-none focus:border-orange-400 transition-colors" />
              </div>
            </div>

            {/* Reason */}
            <input value={snoozeReason} onChange={e => setSnoozeReason(e.target.value)}
              placeholder={language === 'ar' ? 'السبب (اختياري)...' : 'Reason (optional)...'}
              className="w-full px-3 py-2 rounded-xl text-[13px] bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/[0.1] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-orange-400 transition-colors"
              dir="auto" />

            <button onClick={() => sendSnoozeRequest(snoozeSubtask)} disabled={!snoozeDate || sendingSnooze}
              className="w-full py-2.5 rounded-xl text-[13px] font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 transition-all active:scale-95 flex items-center justify-center gap-2">
              {sendingSnooze ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              {language === 'ar' ? 'إرسال الطلب' : 'Send Request'}
            </button>
          </div>
        )}

        {/* LOG tab */}
        {activeTab === 'log' && (
          <div className="space-y-1.5 pt-1">
            {activityLog.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground/50 text-[13px]">{language === 'ar' ? 'لا يوجد نشاط بعد' : 'No activity yet'}</p>
            ) : (
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {[...activityLog].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 30).map(act => (
                  <div key={act.id} className="flex items-start gap-2.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.05]">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-bold text-foreground" dir="auto">{act.visitor_name}</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">{format(parseISO(act.created_at), 'MMM dd, HH:mm')}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground" dir="auto">{act.response_type?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

function generateTaskCode(): string {
  return `W${Math.floor(10000 + Math.random() * 90000)}`;
}

async function getProfileName(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('display_name, first_name, last_name').eq('id', userId).single();
  const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ');
  return data?.display_name || full || 'Wakti User';
}

export const SharedTasksTab: React.FC<SharedTasksTabProps> = ({ tasks, onTasksChanged, incomingShareLink = null }) => {
  const { language } = useTheme();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [expandedAssigned, setExpandedAssigned] = useState<Set<string>>(new Set());
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);
  const [taskCodes, setTaskCodes] = useState<Record<string, string>>({});
  const [joinRequests, setJoinRequests] = useState<Assignment[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setCurrentUserId(user.id);
      setCurrentUserName(await getProfileName(user.id));
    });
  }, []);

  const loadAssignments = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingAssignments(true);
    try {
      const { data } = await supabase
        .from('tr_task_assignments')
        .select('id,task_id,assignee_id,assignee_name,status,requested_at,responded_at,task:tr_tasks(id,title,share_link,task_code,completed,due_date,priority,user_id)')
        .eq('assignee_id', currentUserId)
        .order('requested_at', { ascending: false });
      setAssignments((data || []) as Assignment[]);
    } catch { } finally { setLoadingAssignments(false); }
  }, [currentUserId]);

  const loadJoinRequests = useCallback(async () => {
    if (!currentUserId) return;
    const ids = tasks.filter(t => t.is_shared && t.share_link).map(t => t.id);
    if (!ids.length) { setJoinRequests([]); return; }
    const { data } = await supabase
      .from('tr_task_assignments')
      .select('id,task_id,assignee_id,assignee_name,status,requested_at,responded_at')
      .in('task_id', ids).eq('status', 'pending').order('requested_at', { ascending: false });
    setJoinRequests((data || []) as Assignment[]);
  }, [currentUserId, tasks]);

  const loadTaskCodes = useCallback(() => {
    const map: Record<string, string> = {};
    tasks.filter(t => t.is_shared && t.task_code).forEach(t => { map[t.id] = t.task_code!; });
    setTaskCodes(map);
  }, [tasks]);

  useEffect(() => {
    if (currentUserId) { loadAssignments(); loadJoinRequests(); loadTaskCodes(); }
  }, [currentUserId, loadAssignments, loadJoinRequests, loadTaskCodes]);

  // Realtime: re-fetch when any of the current user's assignment rows change
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel(`assignments-user-${currentUserId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tr_task_assignments', filter: `assignee_id=eq.${currentUserId}` },
        () => { loadAssignments(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, loadAssignments]);

  const handleGenerateCode = async (taskId: string) => {
    setGeneratingCode(taskId);
    try {
      let code = '';
      for (let i = 0; i < 5; i++) {
        code = generateTaskCode();
        const { data } = await supabase.from('tr_tasks').select('id').eq('task_code', code).maybeSingle();
        if (!data) break;
      }
      const { error } = await supabase.from('tr_tasks').update({ task_code: code }).eq('id', taskId);
      if (error) throw error;
      setTaskCodes(p => ({ ...p, [taskId]: code }));
      toast.success(language === 'ar' ? `الكود: ${code}` : `Code: ${code}`);
      onTasksChanged();
    } catch { toast.error('Failed to generate code'); } finally { setGeneratingCode(null); }
  };

  const handleJoinTask = async () => {
    if (!joinCode.trim() || !currentUserId || !currentUserName) return;
    setJoining(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const { data: taskData } = await supabase.from('tr_tasks').select('id,title,user_id,is_shared').eq('task_code', code).eq('is_shared', true).maybeSingle();
      if (!taskData) { toast.error(language === 'ar' ? 'كود غير صحيح' : 'Invalid code'); return; }
      if (taskData.user_id === currentUserId) { toast.error(language === 'ar' ? 'لا يمكنك الانضمام لمهمتك' : 'Cannot join your own task'); return; }
      const { data: existing } = await supabase.from('tr_task_assignments').select('id,status').eq('task_id', taskData.id).eq('assignee_id', currentUserId).maybeSingle();
      if (existing) {
        if (existing.status === 'approved') { toast.info('Already have access'); return; }
        if (existing.status === 'pending') { toast.info('Request already pending'); return; }
        if (existing.status === 'denied') {
          // Delete old denied row so user can re-request
          await supabase.from('tr_task_assignments').delete().eq('id', existing.id);
        }
      }
      await supabase.from('tr_task_assignments').insert({ task_id: taskData.id, assignee_id: currentUserId, assignee_name: currentUserName, status: 'pending' });

      // Send push notification to task owner via edge function (needs service role to insert notification)
      try {
        await supabase.functions.invoke('notify-join-request', {
          body: {
            task_owner_id: taskData.user_id,
            task_id: taskData.id,
            task_title: taskData.title,
            requester_name: currentUserName,
            language,
          },
        });
      } catch (pushErr) {
        console.warn('Push notification failed (non-critical):', pushErr);
      }

      setJoinCode(''); setShowJoinInput(false);
      toast.success(language === 'ar' ? `تم إرسال الطلب لـ "${taskData.title}"` : `Request sent for "${taskData.title}"`);
      await loadAssignments();
    } catch { toast.error('Failed'); } finally { setJoining(false); }
  };

  const handleApproveJoin = async (id: string) => {
    setProcessingRequest(id);
    try {
      await supabase.from('tr_task_assignments').update({ status: 'approved', responded_at: new Date().toISOString() }).eq('id', id);
      toast.success(language === 'ar' ? 'تم القبول' : 'Approved');
      await loadJoinRequests();
    } catch { toast.error('Failed'); } finally { setProcessingRequest(null); }
  };

  const handleDenyJoin = async (id: string) => {
    setProcessingRequest(id);
    try {
      await supabase.from('tr_task_assignments').update({ status: 'denied', responded_at: new Date().toISOString() }).eq('id', id);
      toast.success(language === 'ar' ? 'تم الرفض' : 'Denied');
      await loadJoinRequests();
    } catch { toast.error('Failed'); } finally { setProcessingRequest(null); }
  };

  const [innerTab, setInnerTab] = useState<'mine' | 'assigned'>('mine');

  const mySharedTasks = tasks.filter(t => t.is_shared && t.share_link);
  const approvedAssignments = assignments.filter(a => a.status === 'approved');
  const pendingMyRequests = assignments.filter(a => a.status === 'pending');
  const deniedAssignments = assignments.filter(a => a.status === 'denied');

  return (
    <div className="space-y-4">

      {/* ── Inner tabs + Join button ── */}
      <div className="flex items-center justify-between gap-3">
        {/* Tab pills */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/[0.07]">
          <button
            onClick={() => setInnerTab('mine')}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all touch-manipulation
              ${innerTab === 'mine'
                ? 'bg-white dark:bg-white/[0.1] text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {language === 'ar' ? 'مهامي المشتركة' : 'My Shared Tasks'}
            {mySharedTasks.length > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center
                ${innerTab === 'mine' ? 'bg-indigo-100 dark:bg-indigo-500/30 text-indigo-600 dark:text-indigo-300' : 'bg-slate-200 dark:bg-white/[0.1] text-muted-foreground'}`}>
                {mySharedTasks.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setInnerTab('assigned')}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all touch-manipulation
              ${innerTab === 'assigned'
                ? 'bg-white dark:bg-white/[0.1] text-emerald-700 dark:text-emerald-300 shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
              }`}
          >
            {language === 'ar' ? 'المسندة إليّ' : 'Assigned to Me'}
            {(approvedAssignments.length + pendingMyRequests.length) > 0 && (
              <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center
                ${innerTab === 'assigned' ? 'bg-emerald-100 dark:bg-emerald-500/30 text-emerald-600 dark:text-emerald-300' : 'bg-slate-200 dark:bg-white/[0.1] text-muted-foreground'}`}>
                {approvedAssignments.length + pendingMyRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Join button — only on Assigned tab */}
        {innerTab === 'assigned' && (
          <button onClick={() => setShowJoinInput(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold
              bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300
              border border-indigo-200/70 dark:border-indigo-500/30
              hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-all touch-manipulation active:scale-95">
            <UserPlus className="h-3.5 w-3.5" />
            {language === 'ar' ? 'انضم لمهمة' : 'Join a Task'}
          </button>
        )}
      </div>

      {/* Join input */}
      {showJoinInput && (
        <div className="rounded-2xl p-4 space-y-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200/70 dark:border-indigo-500/30">
          <p className="text-[13px] font-bold text-indigo-700 dark:text-indigo-300">
            {language === 'ar' ? 'أدخل كود المهمة' : 'Enter Task Code'}
          </p>
          <p className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70">
            {language === 'ar' ? 'اطلب الكود من صاحب المهمة (مثال: W12345)' : 'Ask the task owner for their code (e.g. W12345)'}
          </p>
          <div className="flex items-center gap-2">
            <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') handleJoinTask(); }}
              placeholder="W12345" maxLength={6}
              className="flex-1 text-[15px] font-black tracking-widest text-center rounded-xl px-3 py-2.5
                bg-white dark:bg-white/[0.06] border border-indigo-200 dark:border-indigo-500/40
                text-foreground placeholder:text-muted-foreground/30 outline-none
                focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors" />
            <button onClick={handleJoinTask} disabled={joining || joinCode.length < 6}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold bg-indigo-500 text-white
                hover:bg-indigo-600 disabled:opacity-40 transition-all touch-manipulation active:scale-95">
              {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === 'ar' ? 'إرسال' : 'Send')}
            </button>
            <button onClick={() => { setShowJoinInput(false); setJoinCode(''); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white dark:bg-white/[0.06]
                border border-slate-200 dark:border-white/[0.09] text-muted-foreground
                hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── SECTION 1: MY SHARED TASKS ── */}
      {innerTab === 'mine' && mySharedTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-purple-500" />
            <p className="text-[13px] font-black text-foreground tracking-wide">
              {language === 'ar' ? 'مهامي المشتركة' : 'My Shared Tasks'}
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              {mySharedTasks.length}
            </span>
          </div>

          {/* Owner activity monitor — code/link/New buttons are rendered inside each card header */}
          <ActivityMonitor
            tasks={tasks}
            onTasksChanged={onTasksChanged}
            incomingShareLink={null}
            taskCodes={taskCodes}
            onCopyLink={(task) => {
              navigator.clipboard.writeText(`${window.location.origin}/shared-task/${task.share_link}`);
              toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied!');
            }}
            onGenerateCode={handleGenerateCode}
            generatingCode={generatingCode}
          />
        </div>
      )}

      {/* ── SECTION 2: ASSIGNED TO ME ── */}
      {innerTab === 'assigned' && (approvedAssignments.length > 0 || pendingMyRequests.length > 0 || deniedAssignments.length > 0 || loadingAssignments) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-emerald-500 to-teal-500" />
            <p className="text-[13px] font-black text-foreground tracking-wide">
              {language === 'ar' ? 'المهام المسندة إليّ' : 'Assigned to Me'}
            </p>
            {approvedAssignments.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                {approvedAssignments.length}
              </span>
            )}
          </div>

          {loadingAssignments ? (
            <div className="flex items-center justify-center py-8 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending my requests */}
              {pendingMyRequests.map(req => (
                <div key={req.id} className="rounded-xl px-4 py-3 flex items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/30">
                  <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-amber-700 dark:text-amber-300 truncate">
                      {req.task?.title || (language === 'ar' ? 'مهمة...' : 'Task...')}
                    </p>
                    <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70">
                      {language === 'ar' ? 'في انتظار موافقة المالك' : 'Waiting for owner approval'}
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-amber-200/60 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400">
                    {language === 'ar' ? 'معلق' : 'Pending'}
                  </span>
                </div>
              ))}

              {/* Denied requests */}
              {deniedAssignments.map(req => (
                <div key={req.id} className="rounded-xl px-4 py-3 bg-red-50 dark:bg-red-500/10 border border-red-200/70 dark:border-red-500/30">
                  <div className="flex items-center gap-3">
                    <X className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-red-700 dark:text-red-300 truncate">
                        {req.task?.title || (language === 'ar' ? 'مهمة...' : 'Task...')}
                      </p>
                      <p className="text-[11px] text-red-600/70 dark:text-red-400/70">
                        {language === 'ar' ? 'تم رفض طلبك من قبل المالك' : 'Your request was denied by the owner'}
                      </p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-200/60 dark:bg-red-500/20 text-red-700 dark:text-red-400 flex-shrink-0">
                      {language === 'ar' ? 'مرفوض' : 'Denied'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={async () => {
                        if (!req.task?.task_code) { toast.info(language === 'ar' ? 'لا يوجد كود لهذه المهمة' : 'No code for this task'); return; }
                        setJoinCode(req.task.task_code);
                        setShowJoinInput(true);
                        await supabase.from('tr_task_assignments').delete().eq('id', req.id);
                        await loadAssignments();
                      }}
                      className="flex-1 py-1.5 rounded-lg text-[11px] font-bold
                        bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300
                        hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-all active:scale-95">
                      {language === 'ar' ? 'طلب مجدداً' : 'Request Again'}
                    </button>
                    <button
                      onClick={async () => {
                        await supabase.from('tr_task_assignments').delete().eq('id', req.id);
                        await loadAssignments();
                      }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold
                        bg-white dark:bg-white/[0.06] border border-red-200 dark:border-red-500/30
                        text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10
                        transition-all active:scale-95">
                      {language === 'ar' ? 'إغلاق' : 'Dismiss'}
                    </button>
                  </div>
                </div>
              ))}

              {/* Approved — full viewer */}
              {approvedAssignments.map(a => {
                const shareLink = a.task?.share_link;
                if (!shareLink) return null;
                const isExpanded = expandedAssigned.has(a.id);
                const isOverdue = a.task?.due_date && new Date(`${a.task.due_date}T${a.task.due_time || '23:59:59'}`) < new Date() && !a.task.completed;
                return (
                  <div key={a.id} className={`rounded-2xl overflow-hidden bg-white dark:bg-white/[0.04] border ${isOverdue ? 'border-red-200/80 dark:border-red-500/30' : 'border-slate-200/80 dark:border-white/[0.07]'} shadow-[0_2px_16px_hsla(0,0%,0%,0.07)] dark:shadow-[0_2px_16px_hsla(0,0%,0%,0.4)] transition-colors duration-300`}>
                    <button onClick={() => setExpandedAssigned(prev => { const n = new Set(prev); isExpanded ? n.delete(a.id) : n.add(a.id); return n; })}
                      className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors touch-manipulation">
                      <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${a.task?.completed ? 'bg-emerald-400' : isOverdue ? 'bg-red-400' : 'bg-teal-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground truncate">{a.task?.title || '...'}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {a.task?.due_date && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.1] text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(a.task.due_date), 'MMM dd')} {a.task.due_time && `, ${a.task.due_time}`}
                            </span>
                          )}
                          {isOverdue && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-500/20 text-[10px] font-black text-red-600 dark:text-red-400 uppercase tracking-wider">
                              {language === 'ar' ? 'متأخر' : 'Overdue'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/[0.08] border border-slate-200 dark:border-white/[0.08] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2">
                        <AssignedTaskCard assignment={a} language={language} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state — mine tab */}
      {innerTab === 'mine' && mySharedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
            <Users className="h-9 w-9 text-indigo-400/50" />
          </div>
          <p className="text-base font-bold text-foreground mb-2">
            {language === 'ar' ? 'لا توجد مهام مشتركة' : 'No shared tasks yet'}
          </p>
          <p className="text-sm text-muted-foreground/60 max-w-[260px] leading-relaxed">
            {language === 'ar' ? 'شارك مهمة من قائمتك' : 'Share a task from your Tasks list to see it here'}
          </p>
        </div>
      )}
      {/* Empty state — assigned tab */}
      {innerTab === 'assigned' && approvedAssignments.length === 0 && pendingMyRequests.length === 0 && deniedAssignments.length === 0 && !loadingAssignments && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
            <Users className="h-9 w-9 text-indigo-400/50" />
          </div>
          <p className="text-base font-bold text-foreground mb-2">
            {language === 'ar' ? 'لا توجد مهام مشتركة' : 'No shared tasks yet'}
          </p>
          <p className="text-sm text-muted-foreground/60 max-w-[260px] leading-relaxed">
            {language === 'ar' ? 'انضم لمهمة بالكود' : 'Join a task using a task code from the owner'}
          </p>
        </div>
      )}

      {/* Incoming share link viewer (URL redirect from SharedTask.tsx) */}
      {incomingShareLink && (
        <InAppSharedTaskViewer shareLink={incomingShareLink} onDismiss={() => {}} />
      )}
    </div>
  );
};
