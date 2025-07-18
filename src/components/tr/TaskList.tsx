
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MoreHorizontal, Edit, Trash2, Share2, CheckCircle2, Circle, Clock, Moon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
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

  const toggleTaskExpanded = (taskId: string) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
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

  const handleDeleteTask = async (task: TRTask) => {
    if (confirm(t('confirmDeleteTask', language))) {
      try {
        await TRService.deleteTask(task.id);
        toast.success(t('taskDeleted', language));
        onTasksChanged();
      } catch (error) {
        console.error('Error deleting task:', error);
        toast.error(t('errorDeletingTask', language));
      }
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
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                </div>

                {/* Description */}
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
                )}

                {/* Subtasks Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleTaskExpanded(task.id)}
                  className="mt-2 h-8 px-2 text-xs"
                >
                  {expandedTasks.has(task.id) ? t('hideSubtasks', language) : t('showSubtasks', language)} {t('subtasks', language)}
                </Button>

                {/* Subtasks - View Only */}
                {expandedTasks.has(task.id) && (
                  <div className="mt-3 pt-3 border-t">
                    <SubtaskManager 
                      taskId={task.id} 
                      onSubtasksChange={() => {}}
                      readOnly={true}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
