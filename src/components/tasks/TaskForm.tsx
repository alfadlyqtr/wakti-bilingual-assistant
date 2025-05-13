import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Task, TaskPriority, RecurrencePattern, 
  Subtask, useTaskReminder 
} from '@/contexts/TaskReminderContext';
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
import { CalendarIcon, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface TaskFormProps {
  existingTask?: Task;
  onSubmit: (data: Task, subtasks: Omit<Subtask, 'id' | 'task_id'>[]) => Promise<void>;
  onCancel: () => void;
}

interface TaskFormValues {
  title: string;
  description: string;
  dueDate: Date | null;
  dueTime: string;
  priority: TaskPriority;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | '';
  subtaskGroupTitle: string;
}

const TaskForm: React.FC<TaskFormProps> = ({ existingTask, onSubmit, onCancel }) => {
  const { language } = useTheme();
  const [newSubtask, setNewSubtask] = useState('');
  const [subtasks, setSubtasks] = useState<Omit<Subtask, 'id' | 'task_id'>[]>(
    existingTask?.subtasks?.map(s => ({
      title: s.title,
      is_completed: s.is_completed
    })) || []
  );

  const form = useForm<TaskFormValues>({
    defaultValues: {
      title: existingTask?.title || '',
      description: existingTask?.description || '',
      dueDate: existingTask?.due_date ? new Date(existingTask.due_date) : null,
      dueTime: existingTask?.due_date 
        ? format(new Date(existingTask.due_date), 'HH:mm')
        : '12:00',
      priority: existingTask?.priority || 'medium',
      isRecurring: existingTask?.is_recurring || false,
      recurrencePattern: existingTask?.recurrence_pattern || '',
      subtaskGroupTitle: existingTask?.subtask_group_title || '',
    },
  });

  // Handle form submission
  const handleFormSubmit = async (values: TaskFormValues) => {
    // Combine date and time
    let fullDueDate = null;
    if (values.dueDate) {
      const dueDate = new Date(values.dueDate);
      if (values.dueTime) {
        const [hours, minutes] = values.dueTime.split(':').map(Number);
        dueDate.setHours(hours, minutes);
      }
      fullDueDate = dueDate.toISOString();
    }

    const taskData = {
      id: existingTask?.id || '',
      title: values.title,
      description: values.description,
      due_date: fullDueDate,
      priority: values.priority,
      status: existingTask?.status || 'pending',
      is_recurring: values.isRecurring,
      recurrence_pattern: values.isRecurring ? values.recurrencePattern : undefined,
      subtask_group_title: values.subtaskGroupTitle || undefined,
    } as Task;

    await onSubmit(taskData, subtasks);
  };

  const addSubtask = () => {
    if (newSubtask.trim()) {
      setSubtasks([...subtasks, { title: newSubtask.trim(), is_completed: false }]);
      setNewSubtask('');
    }
  };

  const removeSubtask = (index: number) => {
    const updatedSubtasks = [...subtasks];
    updatedSubtasks.splice(index, 1);
    setSubtasks(updatedSubtasks);
  };

  const toggleSubtaskCompletion = (index: number) => {
    const updatedSubtasks = [...subtasks];
    updatedSubtasks[index] = { 
      ...updatedSubtasks[index], 
      is_completed: !updatedSubtasks[index].is_completed 
    };
    setSubtasks(updatedSubtasks);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 p-1">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('taskTitle', language)}</FormLabel>
              <FormControl>
                <Input placeholder={t('taskTitle', language)} {...field} />
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
                  placeholder={t('description', language)} 
                  className="min-h-24"
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
              <FormItem className="flex flex-col">
                <FormLabel>{t('dueDate', language)}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "PPP")
                        ) : (
                          <span>{t('dueDate', language)}</span>
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
                <FormLabel>{t('dueTime', language)}</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('priority', language)}</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('priority', language)} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
                  <SelectItem value="high">{t('highPriority', language)}</SelectItem>
                  <SelectItem value="medium">{t('mediumPriority', language)}</SelectItem>
                  <SelectItem value="low">{t('lowPriority', language)}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subtaskGroupTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('subtaskGroupTitle', language)}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('subtaskGroupTitle', language)}
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="border rounded-md p-3">
          <p className="text-sm font-medium mb-2">{t('subtasks', language)}</p>
          <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
            {subtasks.map((subtask, index) => (
              <div key={index} className="flex items-center justify-between border rounded-md p-2">
                <div className="flex items-center flex-1">
                  <button
                    type="button"
                    className={`flex items-center justify-center w-6 h-6 rounded-full border ${
                      subtask.is_completed 
                        ? 'bg-green-500 border-green-600 text-white' 
                        : 'border-gray-300 bg-background hover:bg-muted/50'
                    } mr-2`}
                    onClick={() => toggleSubtaskCompletion(index)}
                  >
                    {subtask.is_completed && <Check className="w-3 h-3" />}
                  </button>
                  <span className={subtask.is_completed ? 'line-through text-muted-foreground' : ''}>
                    {subtask.title}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-destructive hover:bg-muted rounded-full p-1"
                  onClick={() => removeSubtask(index)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <Input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder={t('addSubtask', language)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="icon"
              onClick={addSubtask}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between border rounded-md p-3">
              <div>
                <FormLabel>{t('recurring', language)}</FormLabel>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch('isRecurring') && (
          <FormField
            control={form.control}
            name="recurrencePattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('recurrencePattern', language)}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('recurrencePattern', language)} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="daily">{t('dailyRecurrence', language)}</SelectItem>
                    <SelectItem value="weekly">{t('weeklyRecurrence', language)}</SelectItem>
                    <SelectItem value="monthly">{t('monthlyRecurrence', language)}</SelectItem>
                    <SelectItem value="yearly">{t('yearlyRecurrence', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('cancel', language)}
          </Button>
          <Button type="submit">
            {existingTask ? t('save', language) : t('createTask', language)}
          </Button>
        </div>
      </form>
    </Form>
  );
};

// Add the handleFormSubmit function that was missing
const handleFormSubmit = async (values: TaskFormValues) => {
  // Combine date and time
  let fullDueDate = null;
  if (values.dueDate) {
    const dueDate = new Date(values.dueDate);
    if (values.dueTime) {
      const [hours, minutes] = values.dueTime.split(':').map(Number);
      dueDate.setHours(hours, minutes);
    }
    fullDueDate = dueDate.toISOString();
  }

  const taskData = {
    id: existingTask?.id || '',
    title: values.title,
    description: values.description,
    due_date: fullDueDate,
    priority: values.priority,
    status: existingTask?.status || 'pending',
    is_recurring: values.isRecurring,
    recurrence_pattern: values.isRecurring ? values.recurrencePattern : undefined,
    subtask_group_title: values.subtaskGroupTitle || undefined,
  } as Task;

  await onSubmit(taskData, subtasks);
};

export default TaskForm;
