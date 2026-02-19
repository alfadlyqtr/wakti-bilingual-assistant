
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Edit, Trash2, Share2, CheckCircle2, Circle, Clock, Moon, ChevronDown, ChevronUp, ListChecks, Grid2X2, CheckCheck, RotateCcw } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { SubtaskManager } from './SubtaskManager';
import { toast } from 'sonner';
import { format, isAfter, parseISO, addDays } from 'date-fns';

interface TaskListProps {
  tasks: TRTask[];
  onTaskEdit: (task: TRTask) => void;
  onTasksChanged: () => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, onTaskEdit, onTasksChanged }) => {
  const { language } = useTheme();
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  // gridLayoutTasks: tasks explicitly set to grid. Default is LIST (better for mobile)
  const [gridLayoutTasks, setGridLayoutTasks] = useState<Set<string>>(new Set());
  const [subtaskVersion, setSubtaskVersion] = useState<Record<string, number>>({});
  const [optimisticAll, setOptimisticAll] = useState<Record<string, {completed: boolean; nonce: number}>>({});
  const [isMdUp, setIsMdUp] = useState<boolean>(false);
  const [latestCompletions, setLatestCompletions] = useState<Record<string, { who: string; when: string }>>({});
  const [deleteTarget, setDeleteTarget] = useState<TRTask | null>(null);
  const channelsRef = useRef<any[]>([]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMdUp('matches' in e ? e.matches : (e as MediaQueryList).matches);
    handler(mq);
    mq.addEventListener?.('change', handler as (ev: Event) => void);
    return () => mq.removeEventListener?.('change', handler as (ev: Event) => void);
  }, []);

  // Load latest main-task completion per shared task and subscribe for realtime updates
  useEffect(() => {
    // Cleanup previous channels
    channelsRef.current.forEach((ch) => ch?.unsubscribe?.());
    channelsRef.current = [];

    const sharedTasks = tasks.filter(t => t.is_shared);
    if (sharedTasks.length === 0) return;

    const loadForTask = async (taskId: string) => {
      try {
        const responses = await TRSharedService.getTaskResponses(taskId);
        const latest = responses
          .filter(r => r.response_type === 'completion' && r.is_completed && !r.subtask_id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        setLatestCompletions(prev => ({
          ...prev,
          [taskId]: latest ? { who: latest.visitor_name, when: latest.created_at } : undefined as any
        }));
      } catch (e) {
        console.warn('Failed loading latest completion for task', taskId, e);
      }
    };

    // Initial load and subscriptions
    sharedTasks.forEach(t => {
      loadForTask(t.id);
      const ch = TRSharedService.subscribeToTaskUpdates(t.id, () => loadForTask(t.id));
      channelsRef.current.push(ch);
    });

    return () => {
      channelsRef.current.forEach((ch) => ch?.unsubscribe?.());
      channelsRef.current = [];
    };
  }, [tasks]);

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const toggleLayoutForTask = (taskId: string) => {
    const next = new Set(gridLayoutTasks);
    if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
    setGridLayoutTasks(next);
  };

  const handleMarkAll = async (taskId: string, completed: boolean) => {
    try {
      // optimistic: update local view immediately
      setOptimisticAll((prev) => ({ ...prev, [taskId]: { completed, nonce: (prev[taskId]?.nonce || 0) + 1 } }));
      const subtasks = await TRService.getSubtasks(taskId);
      // Update owner truth for all subtasks
      await Promise.all(subtasks.map((s) => TRService.updateSubtask(s.id, { completed })));
      // If owner bulk-unchecks, clear ALL completion responses so assignee checkboxes and counts drop immediately
      if (!completed) {
        await Promise.all(subtasks.map((s) => TRSharedService.clearAllSubtaskCompletions(taskId, s.id)));
      }
      // bump version to trigger SubtaskManager reload
      setSubtaskVersion((prev) => ({ ...prev, [taskId]: (prev[taskId] || 0) + 1 }));
      toast.success(
        completed
          ? (language === 'ar' ? 'تم وضع علامة تمّ على جميع المهام الفرعية' : 'Marked all subtasks as done')
          : (language === 'ar' ? 'تم إلغاء علامة تمّ عن جميع المهام الفرعية' : 'Unmarked all subtasks')
      );
    } catch (e) {
      console.error('Mark-all failed', e);
      toast.error(language === 'ar' ? 'فشل الإجراء' : 'Action failed');
    }
  };

  const isOverdue = (task: TRTask) => {
    if (task.completed || !task.due_date) return false;
    
    try {
      const now = new Date();
      const dueDateTime = task.due_time 
        ? parseISO(`${task.due_date}T${task.due_time}`)
        : parseISO(`${task.due_date}T23:59:59`);
      return isAfter(now, dueDateTime);
    } catch (error) {
      console.error('Error parsing task due date:', error, task);
      return false;
    }
  };

  const handleToggleComplete = async (task: TRTask) => {
    try {
      const updates: Partial<TRTask> = {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : undefined
      };
      
      await TRService.updateTask(task.id, updates);
      // Mirror owner action into shared responses so ActivityMonitor and stamps show correct actor
      try {
        if (!task.completed) {
          await TRSharedService.markTaskCompleted(task.id, 'Owner (You)', true);
        } else {
          await TRSharedService.markTaskCompleted(task.id, 'Owner (You)', false);
        }
      } catch (e) {
        console.warn('Non-fatal: failed to mirror owner main-task completion to shared responses', e);
      }
      toast.success(t(task.completed ? 'taskIncomplete' : 'taskCompleted', language));
      onTasksChanged();
    } catch (error) {
      console.error('Error toggling task completion:', error);
      toast.error(t('errorUpdatingTask', language));
    }
  };

  const handleSnoozeTask = async (task: TRTask) => {
    try {
      const tomorrow = addDays(new Date(), 1);
      const updates: Partial<TRTask> = {
        snoozed_until: tomorrow.toISOString()
      };
      
      await TRService.updateTask(task.id, updates);
      toast.success(t('taskSnoozedUntilTomorrow', language));
      onTasksChanged();
    } catch (error) {
      console.error('Error snoozing task:', error);
      toast.error(t('errorSnoozingTask', language));
    }
  };

  const handleDeleteTask = (task: TRTask) => {
    setDeleteTarget(task);
  };

  const handleConfirmDeleteTask = async () => {
    if (!deleteTarget) return;
    const idToDelete = deleteTarget.id;
    // Close dialog FIRST to remove portal overlay before potential unmount
    setDeleteTarget(null);
    try {
      await TRService.deleteTask(idToDelete);
      toast.success(t('taskDeleted', language));
      onTasksChanged();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('errorDeletingTask', language));
    }
  };

  const handleShareTask = async (task: TRTask) => {
    if (task.share_link) {
      const shareUrl = `${window.location.origin}/shared-task/${task.share_link}`;
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('linkCopied', language));
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        toast.error(t('errorCopyingLink', language));
      }
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Circle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t('noTasks', language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => {
        const completed = task.completed;
        const overdue = isOverdue(task);
        const expanded = expandedTasks.has(task.id);

        // Gradient accent colors for the top shimmer bar
        const accentGradient = completed
          ? 'from-emerald-400 via-teal-400 to-emerald-500'
          : overdue
            ? 'from-red-400 via-rose-400 to-red-500'
            : task.priority === 'urgent'
              ? 'from-red-500 via-pink-500 to-rose-500'
              : task.priority === 'high'
                ? 'from-orange-400 via-amber-400 to-orange-500'
                : 'from-[#060541] via-indigo-500 to-[#060541] dark:from-indigo-500 dark:via-blue-400 dark:to-indigo-600';

        // Card glow for dark mode
        const cardGlow = completed
          ? 'dark:shadow-[0_0_20px_hsla(142,76%,55%,0.06)]'
          : overdue
            ? 'dark:shadow-[0_0_20px_hsla(0,80%,55%,0.06)]'
            : 'dark:shadow-[0_0_20px_hsla(210,100%,65%,0.04)]';

        return (
          <div
            key={task.id}
            className={`group relative rounded-2xl overflow-hidden transition-all duration-300
              ${cardGlow}
              ${completed ? 'opacity-75' : ''}`}
          >
            {/* ── Glass card background ── */}
            <div className="absolute inset-0 bg-white/90 dark:bg-white/[0.04] backdrop-blur-xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-slate-100/50 dark:to-white/[0.02]" />
            {/* Border glow */}
            <div className={`absolute inset-0 rounded-2xl border
              ${completed
                ? 'border-emerald-300/40 dark:border-emerald-500/20'
                : overdue
                  ? 'border-red-300/40 dark:border-red-500/20'
                  : 'border-slate-200/80 dark:border-white/[0.08] group-hover:border-[#060541]/20 dark:group-hover:border-indigo-500/20'
              }
              transition-colors duration-300`} />

            {/* ── Top gradient shimmer bar ── */}
            <div className={`h-[3px] bg-gradient-to-r ${accentGradient} relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            </div>

            <div className="relative p-4 md:p-5">
              {/* ── Row 1: Checkbox + Title + Menu ── */}
              <div className="flex items-start gap-3.5">
                {/* Premium checkbox */}
                <button
                  onClick={() => handleToggleComplete(task)}
                  className={`mt-1 flex-shrink-0 w-[22px] h-[22px] rounded-lg flex items-center justify-center transition-all duration-300 touch-manipulation active:scale-90
                    ${completed
                      ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_2px_8px_hsla(142,76%,45%,0.35)]'
                      : 'border-2 border-slate-300/80 dark:border-white/20 hover:border-[#060541] dark:hover:border-indigo-400 hover:shadow-[0_0_8px_hsla(240,80%,50%,0.15)]'
                    }`}
                >
                  {completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                </button>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-bold text-[15px] leading-snug tracking-[-0.01em] ${
                    completed ? 'line-through text-muted-foreground/40' : 'text-foreground'
                  }`}>
                    {task.title}
                  </h3>

                  {/* Description */}
                  {task.description && (
                    <p className="text-[13px] text-muted-foreground/70 mt-1 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* ── Jewel badges row ── */}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <PriorityBadge priority={task.priority} />

                    {task.due_date && (
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                        ${overdue
                          ? 'bg-gradient-to-r from-red-50 to-red-100/80 text-red-600 dark:from-red-900/30 dark:to-red-900/20 dark:text-red-400 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.5)]'
                          : 'bg-slate-100/80 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.3)]'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {format(parseISO(task.due_date), 'MMM d')}
                        {task.due_time && <span className="opacity-60">{task.due_time}</span>}
                      </span>
                    )}

                    {task.is_shared && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                        bg-gradient-to-r from-blue-50 to-indigo-50/80 text-blue-600
                        dark:from-blue-900/25 dark:to-indigo-900/20 dark:text-blue-400
                        shadow-[inset_0_1px_0_hsla(0,0%,100%,0.5)]">
                        <Share2 className="w-3 h-3" />
                        {t('sharedTask', language)}
                      </span>
                    )}

                    {completed && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                        bg-gradient-to-r from-emerald-50 to-teal-50/80 text-emerald-600
                        dark:from-emerald-900/25 dark:to-emerald-900/15 dark:text-emerald-400
                        shadow-[inset_0_1px_0_hsla(0,0%,100%,0.5)]">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('completed', language)}
                      </span>
                    )}

                    {overdue && !completed && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg
                        bg-gradient-to-r from-red-50 to-rose-50/80 text-red-600
                        dark:from-red-900/25 dark:to-red-900/15 dark:text-red-400
                        shadow-[inset_0_1px_0_hsla(0,0%,100%,0.5)]">
                        {t('overdue', language)}
                      </span>
                    )}
                  </div>

                  {/* Shared completion stamp */}
                  {task.is_shared && completed && latestCompletions[task.id]?.when && (
                    <p className="text-[11px] font-medium text-emerald-500 dark:text-emerald-400 mt-2 flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-emerald-400" />
                      {latestCompletions[task.id].who} · {new Date(latestCompletions[task.id].when).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* ── Menu button ── */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm"
                      className="h-8 w-8 p-0 rounded-xl flex-shrink-0 text-muted-foreground/50 hover:text-foreground hover:bg-slate-100/80 dark:hover:bg-white/[0.06] transition-all">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={6}
                      collisionPadding={8}
                      className="z-[2147483000] min-w-[200px] rounded-2xl p-1.5 backdrop-blur-xl
                        bg-white/95 dark:bg-[#1a1d28]/95 border border-slate-200/80 dark:border-white/10
                        shadow-[0_8px_40px_hsla(0,0%,0%,0.12)] dark:shadow-[0_8px_40px_hsla(0,0%,0%,0.5)]"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem onClick={() => handleToggleComplete(task)} className="rounded-xl py-2.5 px-3 text-[13px] font-medium">
                        <CheckCircle2 className="h-4 w-4 mr-2.5" />
                        {completed ? t('markIncomplete', language) : t('markComplete', language)}
                      </DropdownMenuItem>
                      {!completed && (
                        <DropdownMenuItem onClick={() => handleSnoozeTask(task)} className="rounded-xl py-2.5 px-3 text-[13px] font-medium">
                          <Moon className="h-4 w-4 mr-2.5" />
                          {t('snooze', language)}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onTaskEdit(task)} className="rounded-xl py-2.5 px-3 text-[13px] font-medium">
                        <Edit className="h-4 w-4 mr-2.5" />
                        {t('edit', language)}
                      </DropdownMenuItem>
                      {task.is_shared && task.share_link && (
                        <DropdownMenuItem onClick={() => handleShareTask(task)} className="rounded-xl py-2.5 px-3 text-[13px] font-medium">
                          <Share2 className="h-4 w-4 mr-2.5" />
                          {t('shareLink', language)}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleDeleteTask(task)} className="rounded-xl py-2.5 px-3 text-[13px] font-medium text-destructive">
                        <Trash2 className="h-4 w-4 mr-2.5" />
                        {t('delete', language)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              </div>

              {/* ── Subtasks toggle ── */}
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => toggleTaskExpanded(task.id)}
                  className={`flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider py-1.5 px-3 rounded-xl transition-all duration-200 touch-manipulation active:scale-95
                    ${expanded
                      ? 'bg-[#060541]/8 text-[#060541] dark:bg-indigo-500/10 dark:text-indigo-400'
                      : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
                    }`}
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <ListChecks className="w-3.5 h-3.5" />
                  {expanded
                    ? (language === 'ar' ? 'إخفاء' : 'Hide')
                    : (language === 'ar' ? 'المهام الفرعية' : 'Subtasks')}
                </button>

                {expanded && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleLayoutForTask(task.id)}
                      className="h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all touch-manipulation"
                      title={gridLayoutTasks.has(task.id) ? 'Switch to list' : 'Switch to grid'}
                    >
                      {gridLayoutTasks.has(task.id)
                        ? <><ListChecks className="w-3.5 h-3.5" /><span>{language === 'ar' ? 'قائمة' : 'List'}</span></>
                        : <><Grid2X2 className="w-3.5 h-3.5" /><span>{language === 'ar' ? 'شبكة' : 'Grid'}</span></>}
                    </button>
                    <button
                      onClick={() => handleMarkAll(task.id, true)}
                      className="h-7 px-2.5 rounded-lg flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all touch-manipulation"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    <button
                      onClick={() => handleMarkAll(task.id, false)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all touch-manipulation"
                      title="Reset"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Subtasks panel ── */}
              {expanded && (
                <div className="mt-3 pt-4 border-t border-slate-200/60 dark:border-white/[0.06]">
                  <SubtaskManager
                    key={task.id}
                    taskId={task.id}
                    onSubtasksChange={() => setSubtaskVersion((prev) => ({ ...prev, [task.id]: (prev[task.id] || 0) + 1 }))}
                    readOnly={false}
                    layout={gridLayoutTasks.has(task.id) ? 'grid' : 'list'}
                    overrideAllCompleted={optimisticAll[task.id]?.completed}
                    overrideNonce={optimisticAll[task.id]?.nonce}
                    refreshTrigger={subtaskVersion[task.id] || 0}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف المهمة' : 'Delete Task'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد أنك تريد حذف "${deleteTarget?.title}"؟`
                : `Are you sure you want to delete "${deleteTarget?.title}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTask} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
