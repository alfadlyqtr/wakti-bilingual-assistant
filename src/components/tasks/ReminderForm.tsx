
import React from 'react';
import { useForm } from 'react-hook-form';
import { Reminder, RecurrencePattern } from '@/contexts/TaskReminderContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface ReminderFormProps {
  existingReminder?: Reminder;
  onSubmit: (data: Reminder) => Promise<void>;
  onCancel: () => void;
}

interface ReminderFormValues {
  title: string;
  dueDate: Date;
  dueTime: string;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | '';
}

const ReminderForm: React.FC<ReminderFormProps> = ({ existingReminder, onSubmit, onCancel }) => {
  const { language } = useTheme();

  const form = useForm<ReminderFormValues>({
    defaultValues: {
      title: existingReminder?.title || '',
      dueDate: existingReminder?.due_date ? new Date(existingReminder.due_date) : new Date(),
      dueTime: existingReminder?.due_date 
        ? format(new Date(existingReminder.due_date), 'HH:mm')
        : '12:00',
      isRecurring: existingReminder?.is_recurring || false,
      recurrencePattern: existingReminder?.recurrence_pattern || '',
    },
  });

  // Handle form submission
  const handleFormSubmit = async (values: ReminderFormValues) => {
    // Combine date and time
    const dueDate = new Date(values.dueDate);
    if (values.dueTime) {
      const [hours, minutes] = values.dueTime.split(':').map(Number);
      dueDate.setHours(hours, minutes);
    }
    
    const reminderData = {
      id: existingReminder?.id || '',
      title: values.title,
      due_date: dueDate.toISOString(),
      is_recurring: values.isRecurring,
      recurrence_pattern: values.isRecurring ? values.recurrencePattern : undefined,
      created_by: existingReminder?.created_by || '',
      created_at: existingReminder?.created_at || new Date().toISOString(),
      updated_at: existingReminder?.updated_at || new Date().toISOString(),
    };

    await onSubmit(reminderData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 p-1">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('reminderTitle', language)}</FormLabel>
              <FormControl>
                <Input placeholder={t('reminderTitle', language)} {...field} />
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
                      selected={field.value}
                      onSelect={field.onChange as (date: Date | undefined) => void}
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
                    <SelectItem value="daily">{t('daily', language)}</SelectItem>
                    <SelectItem value="weekly">{t('weekly', language)}</SelectItem>
                    <SelectItem value="monthly">{t('monthly', language)}</SelectItem>
                    <SelectItem value="yearly">{t('yearly', language)}</SelectItem>
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
            {existingReminder ? t('save', language) : t('createReminder', language)}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ReminderForm;
