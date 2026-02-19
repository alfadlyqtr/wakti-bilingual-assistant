// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Hash, Loader2, Clock, AlertTriangle,
  X, Check, UserPlus, Link2, Copy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { TRTask } from '@/services/trService';
import { ActivityMonitor } from './ActivityMonitor';
import { InAppSharedTaskViewer } from './InAppSharedTaskViewer';
import { useTheme } from '@/providers/ThemeProvider';
import { toast } from 'sonner';

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
        const msgs = { approved: 'Already have access', pending: 'Request already pending', denied: 'Request was denied' };
        toast.info(msgs[existing.status] || 'Already requested'); return;
      }
      await supabase.from('tr_task_assignments').insert({ task_id: taskData.id, assignee_id: currentUserId, assignee_name: currentUserName, status: 'pending' });
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

  const mySharedTasks = tasks.filter(t => t.is_shared && t.share_link);
  const approvedAssignments = assignments.filter(a => a.status === 'approved');
  const pendingMyRequests = assignments.filter(a => a.status === 'pending');

  return (
    <div className="space-y-6">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-medium text-muted-foreground/50">
          {language === 'ar' ? 'المهام المشتركة' : 'Shared Tasks'}
        </p>
        <button onClick={() => setShowJoinInput(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold
            bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300
            border border-indigo-200/70 dark:border-indigo-500/30
            hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-all touch-manipulation active:scale-95">
          <UserPlus className="h-3.5 w-3.5" />
          {language === 'ar' ? 'انضم لمهمة' : 'Join a Task'}
        </button>
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
      {mySharedTasks.length > 0 && (
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

          {/* Pending join requests */}
          {joinRequests.length > 0 && (
            <div className="rounded-2xl overflow-hidden bg-orange-50 dark:bg-orange-500/10 border border-orange-200/70 dark:border-orange-500/30">
              <div className="px-4 py-2.5 border-b border-orange-200/50 dark:border-orange-500/20">
                <p className="text-[12px] font-black text-orange-700 dark:text-orange-400 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {language === 'ar' ? `${joinRequests.length} طلب انضمام` : `${joinRequests.length} join request${joinRequests.length > 1 ? 's' : ''}`}
                </p>
              </div>
              {joinRequests.map(req => {
                const task = mySharedTasks.find(t => t.id === req.task_id);
                const isProc = processingRequest === req.id;
                return (
                  <div key={req.id} className="px-4 py-3 flex items-center gap-3 border-b border-orange-200/30 dark:border-orange-500/10 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-orange-200 dark:bg-orange-500/30 flex items-center justify-center text-[12px] font-black text-orange-700 dark:text-orange-300 flex-shrink-0">
                      {req.assignee_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground truncate">{req.assignee_name}</p>
                      <p className="text-[11px] text-muted-foreground/60 truncate">
                        {language === 'ar' ? 'يريد الانضمام لـ' : 'wants to join'} "{task?.title || '...'}"
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => handleApproveJoin(req.id)} disabled={!!isProc}
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all touch-manipulation active:scale-95">
                        {isProc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleDenyJoin(req.id)} disabled={!!isProc}
                        className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/30 disabled:opacity-50 transition-all touch-manipulation active:scale-95">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Task code strip per task */}
          <div className="space-y-2">
            {mySharedTasks.map(task => {
              const code = taskCodes[task.id] || task.task_code;
              const isGen = generatingCode === task.id;
              return (
                <div key={task.id} className="rounded-xl px-4 py-3 flex items-center gap-3 bg-white dark:bg-white/[0.03] border border-slate-200/60 dark:border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-foreground truncate">{task.title}</p>
                    {code
                      ? <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[12px] font-black tracking-widest text-indigo-600 dark:text-indigo-400">{code}</span>
                          <button onClick={() => { navigator.clipboard.writeText(code); toast.success(language === 'ar' ? 'تم النسخ' : 'Copied!'); }} className="text-muted-foreground/40 hover:text-indigo-500 transition-colors"><Copy className="h-3 w-3" /></button>
                        </div>
                      : <p className="text-[11px] text-muted-foreground/40 mt-0.5">{language === 'ar' ? 'لا يوجد كود' : 'No code yet'}</p>
                    }
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/shared-task/${task.share_link}`); toast.success(language === 'ar' ? 'تم نسخ الرابط' : 'Link copied!'); }}
                      title={language === 'ar' ? 'نسخ الرابط' : 'Copy URL'}
                      className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-white/[0.06] text-muted-foreground hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-all touch-manipulation active:scale-95">
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleGenerateCode(task.id)} disabled={isGen}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 disabled:opacity-50 transition-all touch-manipulation active:scale-95">
                      {isGen ? <Loader2 className="h-3 w-3 animate-spin" /> : <Hash className="h-3 w-3" />}
                      {code ? (language === 'ar' ? 'تجديد' : 'New') : (language === 'ar' ? 'كود' : 'Code')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Owner activity monitor (approvals + interactions) */}
          <ActivityMonitor tasks={tasks} onTasksChanged={onTasksChanged} incomingShareLink={null} />
        </div>
      )}

      {/* ── SECTION 2: ASSIGNED TO ME ── */}
      {(approvedAssignments.length > 0 || pendingMyRequests.length > 0 || loadingAssignments) && (
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

              {/* Approved — full viewer */}
              {approvedAssignments.map(a => {
                const shareLink = a.task?.share_link;
                if (!shareLink) return null;
                const isExpanded = expandedAssigned.has(a.id);
                return (
                  <div key={a.id} className="rounded-2xl overflow-hidden bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.07] shadow-[0_2px_16px_hsla(0,0%,0%,0.07)] dark:shadow-[0_2px_16px_hsla(0,0%,0%,0.4)]">
                    <button onClick={() => setExpandedAssigned(prev => { const n = new Set(prev); isExpanded ? n.delete(a.id) : n.add(a.id); return n; })}
                      className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors touch-manipulation">
                      <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${a.task?.completed ? 'bg-emerald-400' : 'bg-teal-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-foreground truncate">{a.task?.title || '...'}</p>
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          {language === 'ar' ? 'مسندة إليك · انقر للتفاعل' : 'Assigned to you · tap to interact'}
                        </p>
                      </div>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100 dark:bg-white/[0.06] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        <InAppSharedTaskViewer shareLink={shareLink} onDismiss={() => setExpandedAssigned(prev => { const n = new Set(prev); n.delete(a.id); return n; })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {mySharedTasks.length === 0 && approvedAssignments.length === 0 && pendingMyRequests.length === 0 && !loadingAssignments && (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-500/10 dark:to-purple-500/10 flex items-center justify-center shadow-[0_8px_32px_hsla(240,80%,50%,0.08)] mb-6">
            <Users className="h-9 w-9 text-indigo-400/50" />
          </div>
          <p className="text-base font-bold text-foreground mb-2">
            {language === 'ar' ? 'لا توجد مهام مشتركة' : 'No shared tasks yet'}
          </p>
          <p className="text-sm text-muted-foreground/60 max-w-[260px] leading-relaxed">
            {language === 'ar' ? 'شارك مهمة أو انضم لمهمة بالكود' : 'Share a task from your list, or join one using a task code'}
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
