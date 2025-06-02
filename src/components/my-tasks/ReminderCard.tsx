
import React, { useState } from 'react';
import { useMyTasks, type MyTask } from '@/contexts/MyTasksContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { format, isToday, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Check, Bell, Edit, Trash2, 
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

interface ReminderCardProps {
  reminder: MyTask;
}

const ReminderCard: React.FC<ReminderCardProps> = ({ reminder }) => {
  const { toggleTaskStatus, deleteTask } = useMyTasks();
  const { language } = useTheme();
  const [showEditForm, setShowEditForm] = useState(false);

  const statusIcons = {
    pending: <Circle className="h-5 w-5 text-muted-foreground" />,
    completed: <CheckCircle2 className="h-5 w-5 text-green-600" />,
    overdue: <AlertTriangle className="h-5 w-5 text-red-600" />
  };

  const handleDelete = async () => {
    if (confirm(t('confirmDeleteReminder', language))) {
      await deleteTask(reminder.id);
    }
  };

  const getDueDateDisplay = () => {
    if (!reminder.due_date) return null;
    
    const dueDate = new Date(reminder.due_date);
    const isOverdue = isPast(dueDate) && reminder.status !== 'completed';
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
        border-l-4 border-l-purple-500 rounded-lg p-4 space-y-3 bg-card bg-purple-50 dark:bg-purple-950/20
        ${reminder.status === 'completed' ? 'opacity-70' : ''}
      `}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleTaskStatus(reminder.id)}
                className="flex-shrink-0"
              >
                {statusIcons[reminder.status]}
              </button>
              <Bell className="h-4 w-4 text-purple-600 flex-shrink-0" />
              <h3 className={`font-medium ${reminder.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                {reminder.title}
              </h3>
            </div>
            
            {reminder.description && (
              <p className={`text-sm text-muted-foreground ${reminder.status === 'completed' ? 'line-through' : ''}`}>
                {reminder.description}
              </p>
            )}
            
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {getDueDateDisplay()}
              
              {reminder.is_repeated && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {t('repeated', language)}
                </Badge>
              )}
              
              {reminder.status === 'completed' && (
                <Badge className="bg-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  {t('completed', language)}
                </Badge>
              )}
              
              {reminder.status === 'overdue' && (
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
            <DialogTitle>{t('editReminder', language)}</DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-0">
            <TaskCreationForm
              defaultType="reminder"
              task={reminder}
              onSuccess={() => setShowEditForm(false)}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReminderCard;
