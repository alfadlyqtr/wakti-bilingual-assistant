
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
import { format } from 'date-fns';
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

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
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
    if (reminder) {
      reset({
        title: reminder.title,
        description: reminder.description || '',
        due_date: reminder.due_date || '',
        due_time: reminder.due_time || '',
      });
    } else {
      reset({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
      });
    }
  }, [reminder, reset]);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: ReminderFormData) => {
    setIsLoading(true);
    try {
      // Prepare data for service - ensure title is always provided
      const reminderData = {
        title: data.title, // Required field
        description: data.description || undefined,
        due_date: data.due_date || undefined,
        due_time: data.due_time || undefined,
      };

      if (reminder) {
        await TRService.updateReminder(reminder.id, reminderData);
        toast.success(t('reminderUpdatedSuccessfully', language));
      } else {
        await TRService.createReminder(reminderData);
        toast.success(t('reminderCreatedSuccessfully', language));
      }
      
      onReminderSaved();
      onClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast.error(reminder ? t('failedToUpdateReminder', language) : t('failedToCreateReminder', language));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reminder ? t('editReminder', language) : t('createReminder', language)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('title', language)} *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('enterReminderTitle', language)}
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
              placeholder={t('enterReminderDescription', language)}
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
                ? (reminder ? t('updating', language) : t('creating', language))
                : (reminder ? t('update', language) : t('create', language))
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
