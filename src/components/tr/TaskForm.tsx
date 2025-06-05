
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon, X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
import { toast } from 'sonner';

// Updated schema to make due_date optional
const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional(), // Made optional
  due_time: z.string().optional(),
  priority: z.enum(['normal', 'high', 'urgent']),
  task_type: z.enum(['one-time', 'repeated']),
  is_shared: z.boolean().default(false),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TRTask | null;
  onTaskSaved: () => void;
}

export function TaskForm({ isOpen, onClose, task, onTaskSaved }: TaskFormProps) {
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      due_time: '',
      priority: 'normal',
      task_type: 'one-time',
      is_shared: false,
    },
  });

  const watchedDueDate = watch('due_date');

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description || '',
        due_date: task.due_date || '',
        due_time: task.due_time || '',
        priority: task.priority,
        task_type: task.task_type,
        is_shared: task.is_shared,
      });
    } else {
      reset({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
        priority: 'normal',
        task_type: 'one-time',
        is_shared: false,
      });
      setSubtasks([]);
    }
  }, [task, reset]);

  useEffect(() => {
    if (!isOpen) {
      reset();
      setSubtasks([]);
      setNewSubtask('');
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: TaskFormData) => {
    console.log('TaskForm.onSubmit: Starting form submission');
    console.log('TaskForm.onSubmit: Form data:', data);
    
    setIsLoading(true);
    try {
      // Prepare data for service - ensure title is always provided
      const taskData = {
        title: data.title, // Required field
        description: data.description || undefined,
        due_date: data.due_date || undefined,
        due_time: data.due_time || undefined,
        priority: data.priority,
        task_type: data.task_type,
        is_shared: data.is_shared,
      };

      if (task) {
        console.log('TaskForm.onSubmit: Updating existing task');
        await TRService.updateTask(task.id, taskData);
        toast.success(t('taskUpdatedSuccessfully', language));
      } else {
        console.log('TaskForm.onSubmit: Creating new task');
        const newTask = await TRService.createTask(taskData);
        console.log('TaskForm.onSubmit: Task created:', newTask);
        
        // Create subtasks if any
        if (subtasks.length > 0) {
          console.log('TaskForm.onSubmit: Creating subtasks:', subtasks);
          for (let i = 0; i < subtasks.length; i++) {
            await TRService.createSubtask({
              task_id: newTask.id,
              title: subtasks[i],
              completed: false,
              order_index: i,
            });
          }
        }
        
        toast.success(t('taskCreatedSuccessfully', language));
      }
      
      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('TaskForm.onSubmit: Error saving task:', error);
      toast.error(task ? t('failedToUpdateTask', language) : t('failedToCreateTask', language));
    } finally {
      setIsLoading(false);
    }
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, newSubtask.trim()]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask', language) : t('createTask', language)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('title', language)} *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('enterTaskTitle', language)}
              className={errors.title ? 'border-destructive' : ''}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">{t('description', language)}</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder={t('enterTaskDescription', language)}
              rows={3}
            />
          </div>

          {/* Due Date - Now Optional */}
          <div className="space-y-2">
            <Label htmlFor="due_date">{t('dueDate', language)} {language === 'ar' ? '(اختياري)' : '(optional)'}</Label>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        format(new Date(field.value), "PPP")
                      ) : (
                        <span>{t('selectDate', language)}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => {
                        field.onChange(date ? format(date, 'yyyy-MM-dd') : '');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </div>

          {/* Due Time - Only show if date is selected */}
          {watchedDueDate && (
            <div className="space-y-2">
              <Label htmlFor="due_time">{t('dueTime', language)}</Label>
              <Input
                id="due_time"
                type="time"
                {...register('due_time')}
              />
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <Label>{t('priority', language)}</Label>
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectPriority', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">{t('normal', language)}</SelectItem>
                    <SelectItem value="high">{t('high', language)}</SelectItem>
                    <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>{t('taskType', language)}</Label>
            <Controller
              name="task_type"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectTaskType', language)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                    <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* Subtasks (only for new tasks) */}
          {!task && (
            <div className="space-y-2">
              <Label>{t('subtasks', language)}</Label>
              <div className="space-y-2">
                {subtasks.map((subtask, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={subtask} readOnly className="flex-1" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeSubtask(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder={t('addSubtask', language)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSubtask();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addSubtask}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Sharing */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>{t('shareTask', language)}</Label>
              <p className="text-sm text-muted-foreground">
                {t('shareTaskDescription', language)}
              </p>
            </div>
            <Controller
              name="is_shared"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              {t('cancel', language)}
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading 
                ? (task ? t('updating', language) : t('creating', language))
                : (task ? t('update', language) : t('create', language))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
