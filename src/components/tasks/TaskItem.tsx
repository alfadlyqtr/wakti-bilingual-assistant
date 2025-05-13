
import React from 'react';
import { format, isPast, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import { TaskPriority, Task } from '@/contexts/TaskReminderContext';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, CalendarClock, Share, Edit, Trash } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface TaskItemProps {
  task: Task;
  onComplete: (id: string, completed: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onShare: (task: Task) => void;
}

const PriorityColors: Record<TaskPriority, { bg: string; border: string }> = {
  urgent: { bg: 'bg-red-100 dark:bg-red-950/30', border: 'border-red-500' },
  high: { bg: 'bg-orange-100 dark:bg-orange-950/30', border: 'border-orange-500' },
  medium: { bg: 'bg-blue-100 dark:bg-blue-950/30', border: 'border-blue-500' },
  low: { bg: 'bg-gray-100 dark:bg-gray-800/30', border: 'border-gray-400' },
};

const TaskItem: React.FC<TaskItemProps> = ({ task, onComplete, onEdit, onDelete, onShare }) => {
  const { language } = useTheme();
  const isTaskOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== 'completed';
  const isTaskToday = task.due_date && isToday(new Date(task.due_date));
  
  const priorityStyles = PriorityColors[task.priority];
  
  // Count completed subtasks
  const completedSubtasks = task.subtasks?.filter(subtask => subtask.is_completed)?.length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-4 mb-3 rounded-lg border ${priorityStyles.border} ${priorityStyles.bg} ${
        task.status === 'completed' ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className={`text-lg font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </h3>
          
          {task.description && (
            <p className={`text-sm mt-1 ${task.status === 'completed' ? 'line-through text-muted-foreground' : 'text-foreground/80'}`}>
              {task.description}
            </p>
          )}
          
          {/* Subtasks progress */}
          {totalSubtasks > 0 && (
            <div className="mt-2">
              <div className="text-xs text-foreground/70 flex items-center">
                <span>{completedSubtasks}/{totalSubtasks} {t('subtasks', language)}</span>
                {task.subtask_group_title && <span className="mx-1">• {task.subtask_group_title}</span>}
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 bg-background/50 rounded-full mt-1 overflow-hidden">
                <div 
                  className={`h-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-primary/70'}`} 
                  style={{ width: `${totalSubtasks ? (completedSubtasks / totalSubtasks) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
          
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Due date badge */}
            {task.due_date && (
              <Badge variant={isTaskOverdue ? "destructive" : isTaskToday ? "secondary" : "outline"} className="flex gap-1 items-center">
                <CalendarClock className="h-3 w-3" />
                <span>{format(new Date(task.due_date), 'MMM d, yyyy h:mm a')}</span>
              </Badge>
            )}
            
            {/* Priority badge */}
            <Badge variant="outline" className="flex gap-1 items-center">
              {t(task.priority as TranslationKey, language)}
            </Badge>
            
            {/* Recurrence badge */}
            {task.is_recurring && task.recurrence_pattern && (
              <Badge variant="outline" className="flex gap-1 items-center">
                <Clock className="h-3 w-3" />
                {t(task.recurrence_pattern as TranslationKey, language)}
              </Badge>
            )}
            
            {/* Shared badge */}
            {task.is_shared && (
              <Badge variant="outline" className="flex gap-1 items-center">
                <Share className="h-3 w-3" />
                {t('shared', language)}
              </Badge>
            )}
            
            {/* Status badge */}
            <Badge 
              variant={task.status === 'completed' ? "secondary" : isTaskOverdue ? "destructive" : "outline"}
              className="flex gap-1 items-center"
            >
              {task.status === 'completed' && <Check className="h-3 w-3" />}
              {t(task.status as TranslationKey, language)}
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onComplete(task.id, task.status === 'completed')}
            className={`p-1.5 rounded-full ${
              task.status === 'completed' 
                ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-300' 
                : 'bg-background/80 text-muted-foreground hover:text-primary hover:bg-background'
            }`}
          >
            <Check className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-full bg-background/80 text-muted-foreground hover:text-primary hover:bg-background"
          >
            <Edit className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onShare(task)}
            className="p-1.5 rounded-full bg-background/80 text-muted-foreground hover:text-primary hover:bg-background"
          >
            <Share className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-full bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default TaskItem;
