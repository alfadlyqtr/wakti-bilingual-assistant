
import React, { useState } from 'react';
import { useMyTasks, type MyTask } from '@/contexts/MyTasksContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { format, isToday, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, Clock, Share2, Edit, Trash2, 
  MoreVertical, Calendar, AlertTriangle,
  CheckCircle2, Circle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import TaskCreationForm from './TaskCreationForm';
import { toast } from 'sonner';

interface TaskCardProps {
  task: MyTask;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
  const { toggleTaskStatus, toggleSubtask, deleteTask, enableSharing, disableSharing } = useMyTasks();
  const { language } = useTheme();
  const [showEditForm, setShowEditForm] = useState(false);

  const completedSubtasks = task.subtasks.filter(s => s.completed).length;
  const totalSubtasks = task.subtasks.length;
  
  const priorityColors = {
    normal: 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20',
    urgent: 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20',
    high: 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
  };

  const statusIcons = {
    pending: <Circle className="h-5 w-5 text-muted-foreground" />,
    completed: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    overdue: <AlertTriangle className="h-5 w-5 text-red-600" />
  };

  const handleDelete = async () => {
    if (confirm(t('confirmDeleteTask', language))) {
      await deleteTask(task.id);
    }
  };

  const handleToggleSharing = async () => {
    try {
      if (task.is_shared) {
        await disableSharing(task.id);
      } else {
        const shortId = await enableSharing(task.id);
        const shareUrl = `${window.location.origin}/shared-task/${shortId}`;
        await navigator.clipboard.writeText(shareUrl);
        toast.success(t('shareLinkCopied', language));
      }
    } catch (error) {
      console.error('Error toggling sharing:', error);
    }
  };

  const getDueDateDisplay = () => {
    if (!task.due_date) return null;
    
    const dueDate = new Date(task.due_date);
    const isOverdue = isPast(dueDate) && task.status !== 'completed';
    const isDueToday = isToday(dueDate);
    
    let variant: "default" | "secondary" | "destructive" = "default";
    if (isOverdue) variant = "destructive";
    else if (isDueToday) variant = "secondary";
    
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        {format(dueDate, 'MMM d, h:mm a')}
      </Badge>
    );
  };

  return (
    <>
      <div className={`
        border-l-4 rounded-lg p-4 space-y-3 bg-card
        ${priorityColors[task.priority]}
        ${task.status === 'completed' ? 'opacity-70' : ''}
      `}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleTaskStatus(task.id)}
                className="flex-shrink-0"
              >
                {statusIcons[task.status]}
              </button>
              <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h3>
            </div>
            
            {task.description && (
              <p className={`text-sm text-muted-foreground ${task.status === 'completed' ? 'line-through' : ''}`}>
                {task.description}
              </p>
            )}
            
            {/* Subtasks */}
            {task.subtasks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {completedSubtasks}/{totalSubtasks} {t('subtasks', language)}
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 text-sm">
                      <button
                        onClick={() => toggleSubtask(task.id, subtask.id)}
                        className="flex-shrink-0"
                      >
                        {subtask.completed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <span className={subtask.completed ? 'line-through text-muted-foreground' : ''}>
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {getDueDateDisplay()}
              
              {task.is_repeated && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('repeated', language)}
                </Badge>
              )}
              
              {task.is_shared && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Share2 className="h-3 w-3" />
                  {t('shared', language)}
                </Badge>
              )}
              
              {task.status === 'completed' && (
                <Badge className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  {t('completed', language)}
                </Badge>
              )}
              
              {task.status === 'overdue' && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {t('overdue', language)}
                </Badge>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setShowEditForm(true)}>
                <Edit className="h-4 w-4 mr-2" />
                {t('edit', language)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleSharing}>
                <Share2 className="h-4 w-4 mr-2" />
                {task.is_shared ? t('disableSharing', language) : t('enableSharing', language)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                {t('delete', language)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="sm:max-w-md p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{t('editTask', language)}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-0">
            <TaskCreationForm
              defaultType="task"
              task={task}
              onSuccess={() => setShowEditForm(false)}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TaskCard;
