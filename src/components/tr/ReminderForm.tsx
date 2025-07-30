
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarIcon } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { toast } from 'sonner';

// Updated schema to make due_date optional
const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  due_date: z.string().optional(), // Made optional
  due_time: z.string().optional(),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  reminder?: TRReminder | null;
  onReminderSaved: () => void;
}

export function ReminderForm({ isOpen, onClose, reminder, onReminderSaved }: ReminderFormProps) {
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string>('');

  console.log('ReminderForm - Rendered with reminder:', reminder?.id);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      due_time: '',
    },
  });

  const watchedDueDate = watch('due_date');

  useEffect(() => {
    console.log('ReminderForm - Effect triggered with reminder:', reminder?.id, 'isOpen:', isOpen);
    
    if (isOpen) {
      setFormError(''); // Clear any previous errors
      
      if (reminder) {
        console.log('ReminderForm - Populating form with existing reminder data');
        reset({
          title: reminder.title,
          description: reminder.description || '',
          due_date: reminder.due_date || '',
          due_time: reminder.due_time || '',
        });
      } else {
        console.log('ReminderForm - Resetting form for new reminder');
        reset({
          title: '',
          description: '',
          due_date: '',
          due_time: '',
        });
      }
    }
  }, [reminder, reset, isOpen]);

  // Safe date parsing helper
  const parseDate = (dateString: string) => {
    if (!dateString) return undefined;
    
    try {
      const parsed = parseISO(dateString);
      return isValid(parsed) ? parsed : undefined;
    } catch (error) {
      console.error('ReminderForm - Error parsing date:', error);
      return undefined;
    }
  };

  // Safe date formatting helper
  const formatDateForInput = (date: Date) => {
    try {
      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('ReminderForm - Error formatting date:', error);
      return '';
    }
  };

  const onSubmit = async (data: ReminderFormData) => {
    console.log('ReminderForm - Form submitted with data:', data);
    setIsLoading(true);
    setFormError('');
    
    try {
      // Prepare data for service - ensure title is always provided
      const reminderData = {
        title: data.title.trim(), // Required field
        description: data.description?.trim() || undefined,
        due_date: data.due_date || undefined,
        due_time: data.due_time || undefined,
      };

      console.log('ReminderForm - Sending data to service:', reminderData);

      if (reminder) {
        await TRService.updateReminder(reminder.id, reminderData);
        toast.success(t('reminderUpdatedSuccessfully', language));
        console.log('ReminderForm - Reminder updated successfully');
      } else {
        await TRService.createReminder(reminderData);
        toast.success(t('reminderCreatedSuccessfully', language));
        console.log('ReminderForm - Reminder created successfully');
      }
      
      onReminderSaved();
      onClose();
      
      // Reset form after successful submission
      reset();
    } catch (error) {
      console.error('ReminderForm - Error saving reminder:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setFormError(errorMessage);
      toast.error(reminder ? t('failedToUpdateReminder', language) : t('failedToCreateReminder', language));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    console.log('ReminderForm - Closing form');
    setFormError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reminder ? t('editReminder', language) : t('createReminder', language)}
          </DialogTitle>
        </DialogHeader>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-sm text-red-600">{formError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('title', language)} *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('enterReminderTitle', language)}
              className={errors.title ? 'border-destructive' : ''}
              disabled={isLoading}
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
              placeholder={t('enterReminderDescription', language)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Due Date - Now Optional with Fixed Calendar */}
          <div className="space-y-2">
            <Label htmlFor="due_date">{t('dueDate', language)} {language === 'ar' ? '(اختياري)' : '(optional)'}</Label>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                      disabled={isLoading}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? (
                        (() => {
                          const date = parseDate(field.value);
                          return date ? format(date, "PPP") : field.value;
                        })()
                      ) : (
                        <span>{t('selectDate', language)}</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-60" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDate(field.value)}
                      onSelect={(date) => {
                        const formattedDate = date ? formatDateForInput(date) : '';
                        field.onChange(formattedDate);
                        console.log('ReminderForm - Date selected:', formattedDate);
                      }}
                      initialFocus
                      className="pointer-events-auto"
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
                disabled={isLoading}
              />
            </div>
          )}

          {/* Form Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isLoading}
            >
              {t('cancel', language)}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !watch('title')?.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {reminder ? t('updating', language) : t('creating', language)}...
                </div>
              ) : (
                reminder ? t('update', language) : t('create', language)
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
