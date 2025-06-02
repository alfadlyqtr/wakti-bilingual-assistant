
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Share2, Plus } from 'lucide-react';
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
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [shareTask, setShareTask] = useState(false);
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [subtaskInput, setSubtaskInput] = useState('');

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
        setRecurrence('weekly'); // Default recurrence for existing tasks
        setShareTask(task.is_shared || false);
        // Load subtasks for existing task
        if (task.id) {
          loadSubtasks(task.id);
        }
      } else {
        // Reset form for new task
        setTitle('');
        setDescription('');
        setDueDate(undefined);
        setDueTime('');
        setPriority('normal');
        setTaskType('one-time');
        setRecurrence('weekly');
        setShareTask(false);
        setSubtasks([]);
        setSubtaskInput('');
      }
    }
  }, [isOpen, task]);

  const loadSubtasks = async (taskId: string) => {
    try {
      const data = await TRService.getSubtasks(taskId);
      setSubtasks(data);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

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
        recurrence: taskType === 'repeated' ? recurrence : null,
        is_shared: shareTask
      };

      if (task) {
        // For existing tasks, only update editable fields
        const updateData = {
          due_date: taskData.due_date,
          due_time: taskData.due_time,
          priority: taskData.priority,
          task_type: taskData.task_type,
          recurrence: taskData.recurrence,
          is_shared: taskData.is_shared
        };
        await TRService.updateTask(task.id, updateData);
        showSuccess(t('taskUpdated', language));
      } else {
        // Create task first
        const newTask = await TRService.createTask(taskData);
        
        // Then create subtasks if any
        if (subtasks.length > 0) {
          for (let i = 0; i < subtasks.length; i++) {
            const subtask = subtasks[i];
            await TRService.createSubtask({
              task_id: newTask.id,
              title: subtask.title,
              completed: subtask.completed,
              order_index: i
            });
          }
        }
        
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

  const handleSubtaskAdd = (title: string) => {
    const newSubtask: TRSubtask = {
      id: `temp-${Date.now()}`,
      task_id: '',
      title,
      completed: false,
      order_index: subtasks.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setSubtasks([...subtasks, newSubtask]);
  };

  const handleSubtaskUpdate = (id: string, updates: Partial<TRSubtask>) => {
    setSubtasks(subtasks.map(st => 
      st.id === id ? { ...st, ...updates } : st
    ));
  };

  const handleSubtaskDelete = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const handleAddSubtaskFromInput = () => {
    if (subtaskInput.trim()) {
      handleSubtaskAdd(subtaskInput.trim());
      setSubtaskInput('');
    }
  };

  const handleSubtaskInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtaskFromInput();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask', language) : t('createTask', language)}
          </DialogTitle>
          {task && (
            <p className="text-blue-600 font-medium text-sm mt-1">
              {task.title}
            </p>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Only show title and description for new tasks */}
          {!task && (
            <>
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
            </>
          )}

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

          {/* Priority and Task Type on same line */}
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          {/* Recurrence Options - Show only when task type is repeated */}
          {taskType === 'repeated' && (
            <div className="space-y-2">
              <Label>{t('recurrence', language)}</Label>
              <Select value={recurrence} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => setRecurrence(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Every Day</SelectItem>
                  <SelectItem value="weekly">Every Week</SelectItem>
                  <SelectItem value="monthly">Every Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subtasks Section - Show for both new and existing tasks */}
          <div className="space-y-2">
            <Label>{t('subtasks', language)}</Label>
            {task ? (
              <SubtaskManager taskId={task.id} />
            ) : (
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 bg-secondary/20 rounded-md">
                    <span className="flex-1 text-sm">{subtask.title}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSubtaskDelete(subtask.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      ×
                    </Button>
                  </div>
                ))}
                <div className="relative">
                  <Input
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={handleSubtaskInputKeyDown}
                    placeholder="Enter subtask"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleAddSubtaskFromInput}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-between items-center pt-4">
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel', language)}
              </Button>
              <Button
                type="button"
                variant={shareTask ? "default" : "outline"}
                onClick={() => setShareTask(!shareTask)}
                className="flex items-center gap-2"
              >
                <Share2 className="h-4 w-4" />
                {shareTask ? t('sharedTask', language) : t('shareTask', language)}
              </Button>
            </div>
            
            <Button type="submit" disabled={loading || (!task && !title.trim()) || !dueDate}>
              {loading ? t('loading', language) : task ? t('save', language) : t('create', language)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
