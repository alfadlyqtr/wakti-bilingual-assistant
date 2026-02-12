
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Edit, Trash2, Share2, CheckCircle2, Circle, Clock, Moon } from 'lucide-react';
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
    try {
      await TRService.deleteTask(deleteTarget.id);
      toast.success(t('taskDeleted', language));
      onTasksChanged();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(t('errorDeletingTask', language));
    } finally {
      setDeleteTarget(null);
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
      {tasks.map((task) => (
        <Card key={task.id} className="overflow-hidden">
          <CardContent className="p-4">
            {/* Task Header */}
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleComplete(task)}
                className="p-0 h-auto mt-1"
              >
                {task.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.title}
                    </h3>
                    <PriorityBadge priority={task.priority} />
                    {task.is_shared && (
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                        {t('sharedTask', language)}
                      </span>
                    )}
                    {/* Airport-stamp badge for shared tasks when completed */}
                    {task.is_shared && task.completed && latestCompletions[task.id] && (
                      <span className="text-[11px] px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200">
                        ✓ Completed by: {latestCompletions[task.id].who}
                      </span>
                    )}
                  </div>
                  
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={6}
                        collisionPadding={8}
                        className="z-[2147483000] min-w-[180px]"
                        onCloseAutoFocus={(e) => e.preventDefault()}
                      >
                      <DropdownMenuItem onClick={() => handleToggleComplete(task)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        {task.completed ? t('markIncomplete', language) : t('markComplete', language)}
                      </DropdownMenuItem>
                      {!task.completed && (
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

                {/* Task Details */}
                {task.due_date && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>
                      {t('dueOn', language)} {format(parseISO(task.due_date), 'MMM dd, yyyy')}
                      {task.due_time && ` at ${task.due_time}`}
                    </span>
                  </div>
                )}

                {/* Status Badge */}
                <div className="mt-2">
                  <StatusBadge completed={task.completed} isOverdue={isOverdue(task)} />
                  {task.is_shared && task.completed && latestCompletions[task.id]?.when && (
                    <div className="mt-1 text-[11px] text-emerald-700">
                      {new Date(latestCompletions[task.id].when).toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                {/* Description */}
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
                )}

                {/* Subtasks Toggle */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleTaskExpanded(task.id)}
                  className="mt-2 h-8 px-3 text-xs shadow-sm hover:shadow"
                >
                  {expandedTasks.has(task.id) ? t('hideSubtasks', language) : t('showSubtasks', language)} {t('subtasks', language)}
                </Button>

                {/* Subtasks - Controls + List */}
                {expandedTasks.has(task.id) && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-muted-foreground">
                        {language === 'ar' ? 'المهام الفرعية' : 'Subtasks'}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleLayoutForTask(task.id)}
                          className="h-8 hidden md:inline-flex"
                        >
                          {gridLayoutTasks.has(task.id)
                            ? (language === 'ar' ? 'عرض قائمة' : 'List view')
                            : (language === 'ar' ? 'عرض مدمج' : 'Compact grid')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAll(task.id, true)}
                          className="h-8"
                        >
                          {language === 'ar' ? 'اجعل الكل تمّ' : 'Mark all done'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAll(task.id, false)}
                          className="h-8"
                        >
                          {language === 'ar' ? 'إلغاء الكل' : 'Unmark all'}
                        </Button>
                      </div>
                    </div>
                    <SubtaskManager 
                      key={`${task.id}-${subtaskVersion[task.id] || 0}`}
                      taskId={task.id} 
                      onSubtasksChange={() => setSubtaskVersion((prev) => ({ ...prev, [task.id]: (prev[task.id] || 0) + 1 }))}
                      readOnly={false}
                      layout={(gridLayoutTasks.has(task.id) || isMdUp) ? 'grid' : 'list'}
                      overrideAllCompleted={optimisticAll[task.id]?.completed}
                      overrideNonce={optimisticAll[task.id]?.nonce}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
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
