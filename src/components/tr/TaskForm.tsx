
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask, TRSubtask } from '@/services/trService';
import { SubtaskManager } from './SubtaskManager';
import { useToastHelper } from '@/hooks/use-toast-helper';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TRTask | null;
  onTaskSaved: () => void;
}

export function TaskForm({ isOpen, onClose, task, onTaskSaved }: TaskFormProps) {
  const { language } = useTheme();
  const { showSuccess, showError } = useToastHelper();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [taskType, setTaskType] = useState<'one-time' | 'repeated'>('one-time');
  const [shareTask, setShareTask] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens/closes or task changes
  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description || '');
        setDueDate(task.due_date ? new Date(task.due_date) : undefined);
        setDueTime(task.due_time || '');
        setPriority(task.priority);
        setTaskType(task.task_type);
        setShareTask(task.is_shared || false);
      } else {
        // Reset form for new task
        setTitle('');
        setDescription('');
        setDueDate(undefined);
        setDueTime('');
        setPriority('normal');
        setTaskType('one-time');
        setShareTask(false);
      }
    }
  }, [isOpen, task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        due_time: dueTime || null,
        priority,
        task_type: taskType,
        is_shared: shareTask
      };

      if (task) {
        await TRService.updateTask(task.id, taskData);
        showSuccess(t('taskUpdated', language));
      } else {
        await TRService.createTask(taskData);
        showSuccess(t('taskCreated', language));
      }

      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      showError('Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask', language) : t('createTask', language)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('taskTitle', language)} *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('enterTaskTitle', language)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('description', language)} ({t('optional', language)})</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('enterDescription', language)}
              rows={3}
            />
          </div>

          {/* Due Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('dueDate', language)} *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd/MM/yyyy') : t('selectDate', language)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">{t('dueTime', language)} ({t('optional', language)})</Label>
              <Input
                id="time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>{t('priority', language)}</Label>
            <Select value={priority} onValueChange={(value: 'normal' | 'high' | 'urgent') => setPriority(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t('normal', language)}</SelectItem>
                <SelectItem value="high">{t('high', language)}</SelectItem>
                <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>{t('taskType', language)}</Label>
            <Select value={taskType} onValueChange={(value: 'one-time' | 'repeated') => setTaskType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Share Task */}
          <div className="flex items-center justify-between">
            <Label htmlFor="share">{t('shareTask', language)}</Label>
            <Switch
              id="share"
              checked={shareTask}
              onCheckedChange={setShareTask}
            />
          </div>

          {/* Subtasks Section - Only show for existing tasks */}
          {task && (
            <div className="space-y-2">
              <Label>{t('subtasks', language)}</Label>
              <SubtaskManager
                taskId={task.id}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {t('cancel', language)}
            </Button>
            <Button type="submit" disabled={loading || !title.trim() || !dueDate}>
              {loading ? t('loading', language) : t('save', language)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
