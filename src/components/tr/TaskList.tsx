
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
  const [listLayoutTasks, setListLayoutTasks] = useState<Set<string>>(new Set());
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
    const next = new Set(listLayoutTasks);
    if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
    setListLayoutTasks(next);
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
    <div className="space-y-3">
      {tasks.map((task) => {
        const completed = task.completed;
        const overdue = isOverdue(task);
        const expanded = expandedTasks.has(task.id);

        const accentColor = completed
          ? 'bg-emerald-500'
          : overdue
            ? 'bg-red-500'
            : task.priority === 'urgent'
              ? 'bg-red-500'
              : task.priority === 'high'
                ? 'bg-orange-400'
                : 'bg-[#060541] dark:bg-indigo-500';

        return (
          <div
            key={task.id}
            className={`group relative rounded-2xl overflow-hidden transition-all duration-200
              bg-card border
              ${completed
                ? 'border-emerald-200/60 dark:border-emerald-800/30 opacity-80'
                : overdue
                  ? 'border-red-200/70 dark:border-red-800/40'
                  : 'border-border hover:border-border/80'
              }
              shadow-sm`}
          >
            {/* Left accent stripe */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />

            <div className="pl-4 pr-4 py-4">
              {/* Row 1: checkbox + title + menu */}
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button
                  onClick={() => handleToggleComplete(task)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 touch-manipulation active:scale-90
                    ${completed
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-muted-foreground/30 hover:border-[#060541] dark:hover:border-indigo-400'
                    }`}
                >
                  {completed && <CheckCircle2 className="w-3 h-3" />}
                </button>

                {/* Title + badges */}
                <div className="flex-1 min-w-0">
                  <h3 className={`font-semibold text-[15px] leading-snug ${
                    completed ? 'line-through text-muted-foreground/50' : 'text-foreground'
                  }`}>
                    {task.title}
                  </h3>

                  {/* Meta row */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <PriorityBadge priority={task.priority} />
                    {task.due_date && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full
                        ${overdue
                          ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-muted text-muted-foreground'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {format(parseISO(task.due_date), 'MMM d')}
                        {task.due_time && <span className="opacity-70"> {task.due_time}</span>}
                      </span>
                    )}
                    {task.is_shared && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        <Share2 className="w-3 h-3" />
                        {t('sharedTask', language)}
                      </span>
                    )}
                    {completed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('completed', language)}
                      </span>
                    )}
                    {overdue && !completed && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100/80 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {t('overdue', language)}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {/* Shared completion stamp */}
                  {task.is_shared && completed && latestCompletions[task.id]?.when && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                      {latestCompletions[task.id].who} · {new Date(latestCompletions[task.id].when).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Menu */}
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full flex-shrink-0 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuContent
                      align="end"
                      sideOffset={6}
                      collisionPadding={8}
                      className="z-[2147483000] min-w-[180px] rounded-xl"
                      onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                      <DropdownMenuItem onClick={() => handleToggleComplete(task)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {completed ? t('markIncomplete', language) : t('markComplete', language)}
                      </DropdownMenuItem>
                      {!completed && (
                        <DropdownMenuItem onClick={() => handleSnoozeTask(task)}>
                          <Moon className="h-4 w-4 mr-2" />
                          {t('snooze', language)}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onTaskEdit(task)}>
                        <Edit className="h-4 w-4 mr-2" />
                        {t('edit', language)}
                      </DropdownMenuItem>
                      {task.is_shared && task.share_link && (
                        <DropdownMenuItem onClick={() => handleShareTask(task)}>
                          <Share2 className="h-4 w-4 mr-2" />
                          {t('shareLink', language)}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDeleteTask(task)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {t('delete', language)}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenuPortal>
                </DropdownMenu>
              </div>

              {/* Row 2: Subtasks toggle bar */}
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => toggleTaskExpanded(task.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors touch-manipulation active:scale-95 py-1"
                >
                  {expanded
                    ? <ChevronUp className="w-3.5 h-3.5" />
                    : <ChevronDown className="w-3.5 h-3.5" />}
                  <ListChecks className="w-3.5 h-3.5" />
                  {expanded
                    ? (language === 'ar' ? 'إخفاء المهام الفرعية' : 'Hide subtasks')
                    : (language === 'ar' ? 'عرض المهام الفرعية' : 'Show subtasks')}
                </button>

                {expanded && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleLayoutForTask(task.id)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                      title={listLayoutTasks.has(task.id) ? 'Grid view' : 'List view'}
                    >
                      {listLayoutTasks.has(task.id)
                        ? <Grid2X2 className="w-3.5 h-3.5" />
                        : <ListChecks className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleMarkAll(task.id, true)}
                      className="h-7 px-2 rounded-lg flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors touch-manipulation"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    <button
                      onClick={() => handleMarkAll(task.id, false)}
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors touch-manipulation"
                      title="Reset"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Subtasks panel */}
              {expanded && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <SubtaskManager
                    key={task.id}
                    taskId={task.id}
                    onSubtasksChange={() => setSubtaskVersion((prev) => ({ ...prev, [task.id]: (prev[task.id] || 0) + 1 }))}
                    readOnly={false}
                    layout={listLayoutTasks.has(task.id) ? 'list' : 'grid'}
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
