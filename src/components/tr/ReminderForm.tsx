
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
import { CalendarIcon, Clock } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { toast } from 'sonner';

const reminderSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  // Date remains optional, user can create a reminder without a date.
  due_date: z.string().optional(),
  // Time is required per user request (non-optional)
  due_time: z.string().min(1, 'Due time is required'),
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

          {/* Due Date & Time - same row for better mobile/desktop layout */}
          <div className="space-y-2">
            <Label htmlFor="due_time">
              {t('dueDate', language)} / {t('dueTime', language)}
            </Label>
            <div className="flex flex-col sm:flex-row gap-2">
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
                    <PopoverContent className="w-auto p-0 z-[9999]" align="start" side="bottom">
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

              <div className="flex-1 min-w-[120px]">
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="due_time"
                    type="time"
                    {...register('due_time')}
                    disabled={isLoading}
                    className="pl-9 text-base"
                    style={{ colorScheme: 'light dark' }}
                  />
                </div>
                {errors.due_time && (
                  <p className="mt-1 text-xs text-destructive">{errors.due_time.message}</p>
                )}
              </div>
            </div>

            {/* Quick time presets */}
            <div className="flex flex-wrap gap-2 pt-3">
              {[
                { label: language === 'ar' ? '+1 د' : '+1m', minutes: 1 },
                { label: language === 'ar' ? '+5 د' : '+5m', minutes: 5 },
                { label: language === 'ar' ? '+10 د' : '+10m', minutes: 10 },
                { label: language === 'ar' ? '+15 د' : '+15m', minutes: 15 },
                { label: language === 'ar' ? '+20 د' : '+20m', minutes: 20 },
                { label: language === 'ar' ? '+1 س' : '+1h', minutes: 60 },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 text-[11px] px-3.5 rounded-full bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:from-primary hover:to-primary shadow-md border border-primary/60 transition-all focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 disabled:opacity-60"
                  disabled={isLoading}
                  onClick={() => {
                    // Get current values or start from now
                    const currentDate = watch('due_date');
                    const currentTime = watch('due_time');
                    
                    let baseDate: Date;
                    
                    if (currentDate && currentTime) {
                      // If both date and time are set, add to that time
                      baseDate = parseISO(currentDate);
                      const [hours, minutes] = currentTime.split(':').map(Number);
                      baseDate.setHours(hours, minutes, 0, 0);
                    } else if (currentDate) {
                      // If only date is set, start from that date at current time
                      baseDate = parseISO(currentDate);
                      const now = new Date();
                      baseDate.setHours(now.getHours(), now.getMinutes(), 0, 0);
                    } else {
                      // If nothing is set, start from now
                      baseDate = new Date();
                    }
                    
                    // Add the preset minutes
                    const targetDate = new Date(baseDate.getTime() + preset.minutes * 60000);
                    const targetTime = `${String(targetDate.getHours()).padStart(2, '0')}:${String(targetDate.getMinutes()).padStart(2, '0')}`;

                    setValue('due_date', formatDateForInput(targetDate));
                    setValue('due_time', targetTime);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {language === 'ar' ? 'اضغط عدة مرات للإضافة (مثال: 5×5د = 25د)' : 'Tap multiple times to stack (e.g., 5×5m = 25m)'}
            </p>
          </div>

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
