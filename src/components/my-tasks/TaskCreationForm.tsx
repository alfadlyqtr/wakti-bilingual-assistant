
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMyTasks, type MyTask, type Subtask } from '@/contexts/MyTasksContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { 
  Form, FormControl, FormField, FormItem, FormLabel 
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { CalendarIcon, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskFormData {
  title: string;
  description: string;
  dueDate: Date | null;
  dueTime: string;
  priority: 'normal' | 'urgent' | 'high';
  task_type: 'task' | 'reminder';
  is_repeated: boolean;
  is_shared: boolean;
}

interface TaskCreationFormProps {
  defaultType: 'task' | 'reminder';
  task?: MyTask;
  onSuccess: () => void;
  onCancel: () => void;
}

const TaskCreationForm: React.FC<TaskCreationFormProps> = ({ 
  defaultType, 
  task, 
  onSuccess, 
  onCancel 
}) => {
  const { createTask, updateTask } = useMyTasks();
  const { language } = useTheme();
  const [subtasks, setSubtasks] = useState<Subtask[]>(task?.subtasks || []);
  const [newSubtask, setNewSubtask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TaskFormData>({
    defaultValues: {
      title: task?.title || '',
      description: task?.description || '',
      dueDate: task?.due_date ? new Date(task.due_date) : null,
      dueTime: task?.due_date ? format(new Date(task.due_date), 'HH:mm') : '12:00',
      priority: task?.priority || 'normal',
      task_type: task?.task_type || defaultType,
      is_repeated: task?.is_repeated || false,
      is_shared: task?.is_shared || false,
    },
  });

  const addSubtask = () => {
    if (newSubtask.trim()) {
      const newId = Date.now().toString();
      setSubtasks([...subtasks, { id: newId, title: newSubtask.trim(), completed: false }]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    try {
      let fullDueDate = null;
      if (data.dueDate) {
        const dueDate = new Date(data.dueDate);
        if (data.dueTime) {
          const [hours, minutes] = data.dueTime.split(':').map(Number);
          dueDate.setHours(hours, minutes);
        }
        fullDueDate = dueDate.toISOString();
      }

      const taskData = {
        title: data.title,
        description: data.description || undefined,
        due_date: fullDueDate,
        priority: data.priority,
        task_type: data.task_type,
        is_repeated: data.is_repeated,
        is_shared: data.is_shared,
        status: 'pending' as const,
        subtasks: data.task_type === 'task' ? subtasks : [],
      };

      if (task) {
        await updateTask(task.id, taskData);
      } else {
        await createTask(taskData);
      }
      
      onSuccess();
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const taskType = form.watch('task_type');

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="task_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('type', language)}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="task">{t('task', language)}</SelectItem>
                  <SelectItem value="reminder">{t('reminder', language)}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('title', language)}</FormLabel>
              <FormControl>
                <Input placeholder={t('enterTitle', language)} {...field} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('description', language)}</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder={t('enterDescription', language)} 
                  className="min-h-20"
                  {...field} 
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('dueDate', language)}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>{t('pickDate', language)}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value || undefined}
                      onSelect={field.onChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="dueTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('time', language)}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {taskType === 'task' && (
          <>
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('priority', language)}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">🔵 {t('normal', language)}</SelectItem>
                      <SelectItem value="urgent">🟠 {t('urgent', language)}</SelectItem>
                      <SelectItem value="high">🔴 {t('high', language)}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            {/* Subtasks Section */}
            <div className="space-y-3">
              <FormLabel>{t('subtasks', language)}</FormLabel>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-center gap-2 p-2 border rounded">
                    <span className="flex-1 text-sm">{subtask.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubtask(subtask.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder={t('addSubtask', language)}
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSubtask();
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addSubtask}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="space-y-3">
          <FormField
            control={form.control}
            name="is_repeated"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel>{t('repeatedTask', language)}</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="is_shared"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between">
                <FormLabel>{t('shareTask', language)}</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            {t('cancel', language)}
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? t('saving', language) : t(task ? 'save' : 'create', language)}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default TaskCreationForm;
