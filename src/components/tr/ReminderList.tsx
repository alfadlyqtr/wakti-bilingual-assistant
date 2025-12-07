
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Calendar, Clock, Edit, Trash2, Pause } from 'lucide-react';
import { format, isPast, parseISO, differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { ReminderForm } from './ReminderForm';
import { toast } from 'sonner';

interface ReminderListProps {
  reminders?: TRReminder[];
  onReminderEdit?: (reminder: TRReminder) => void;
  onRemindersChanged?: () => void;
  onReminderUpdate?: () => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ 
  reminders: propReminders, 
  onReminderEdit, 
  onRemindersChanged, 
  onReminderUpdate 
}) => {
  const { language } = useTheme();
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<TRReminder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const [tick, setTick] = useState(0); // For countdown refresh

  console.log('ReminderList - Rendered with propReminders:', propReminders?.length);

  useEffect(() => {
    if (propReminders) {
      console.log('ReminderList - Using prop reminders:', propReminders.length);
      // Filter out snoozed reminders if using prop reminders
      const now = new Date();
      const activeReminders = propReminders.filter(reminder => {
        if (!reminder.snoozed_until) return true;
        return parseISO(reminder.snoozed_until) <= now;
      });
      setReminders(activeReminders);
      setLoading(false);
      setError('');
    } else {
      console.log('ReminderList - Loading own reminders');
      loadReminders();
    }
  }, [propReminders]);

  const loadReminders = async () => {
    try {
      setLoading(true);
      setError('');
      console.log('ReminderList - Fetching reminders from service');
      
      const data = await TRService.getReminders();
      
      console.log('ReminderList - Fetched reminders:', data.length);
      
      // Filter out snoozed reminders
      const now = new Date();
      const activeReminders = data.filter(reminder => {
        if (!reminder.snoozed_until) return true;
        return parseISO(reminder.snoozed_until) <= now;
      });
      
      console.log('ReminderList - Active reminders after filtering:', activeReminders.length);
      setReminders(activeReminders);
    } catch (error) {
      console.error('ReminderList - Error loading reminders:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load reminders';
      setError(errorMessage);
      toast.error(t('errorLoadingReminders', language));
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEditReminder = (reminder: TRReminder) => {
    console.log('ReminderList - Edit reminder clicked:', reminder.id);
    
    if (onReminderEdit) {
      onReminderEdit(reminder);
    } else {
      setEditingReminder(reminder);
      setIsFormOpen(true);
    }
  };

  const handleSnoozeReminder = async (reminder: TRReminder) => {
    try {
      console.log('ReminderList - Snoozing reminder:', reminder.id);
      await TRService.snoozeReminder(reminder.id);
      toast.success(t('snoozeReminder', language));
      
      if (onRemindersChanged) {
        onRemindersChanged();
      } else {
        loadReminders();
      }
      onReminderUpdate?.();
    } catch (error) {
      console.error('ReminderList - Error snoozing reminder:', error);
      toast.error(t('errorSnoozing', language));
    }
  };

  const handleDeleteClick = async (reminder: TRReminder) => {
    const confirmMsg = language === 'ar' 
      ? `هل أنت متأكد أنك تريد حذف "${reminder.title}"؟`
      : `Are you sure you want to delete "${reminder.title}"?`;
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      console.log('ReminderList - Deleting reminder:', reminder.id);
      await TRService.deleteReminder(reminder.id);
      toast.success(t('reminderDeleted', language));
      
      if (onRemindersChanged) {
        onRemindersChanged();
      } else {
        await loadReminders();
      }
      onReminderUpdate?.();
    } catch (error) {
      console.error('ReminderList - Error deleting reminder:', error);
      toast.error(t('errorDeleting', language));
    }
  };

  const handleFormClose = () => {
    console.log('ReminderList - Form closed');
    setIsFormOpen(false);
    setEditingReminder(null);
  };

  const handleReminderSaved = () => {
    console.log('ReminderList - Reminder saved, refreshing data');
    
    if (onRemindersChanged) {
      onRemindersChanged();
    } else {
      loadReminders();
    }
    onReminderUpdate?.();
  };

  const getReminderDateTime = (reminder: TRReminder): Date | null => {
    if (!reminder.due_date) return null;
    try {
      const reminderDate = parseISO(reminder.due_date);
      if (reminder.due_time) {
        const [hours, minutes] = reminder.due_time.split(':');
        reminderDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }
      return reminderDate;
    } catch {
      return null;
    }
  };

  const isOverdue = (reminder: TRReminder) => {
    const dt = getReminderDateTime(reminder);
    return dt ? isPast(dt) : false;
  };

  // Countdown text helper
  const getCountdownText = (reminder: TRReminder): string | null => {
    const dt = getReminderDateTime(reminder);
    if (!dt) return null;
    const now = new Date();
    const diffSec = differenceInSeconds(dt, now);
    if (diffSec <= 0) {
      // Overdue
      const overdueSec = Math.abs(diffSec);
      if (overdueSec < 60) return language === 'ar' ? `متأخر بـ ${overdueSec} ث` : `Overdue by ${overdueSec}s`;
      const overdueMin = Math.floor(overdueSec / 60);
      if (overdueMin < 60) return language === 'ar' ? `متأخر بـ ${overdueMin} د` : `Overdue by ${overdueMin}m`;
      const overdueHr = Math.floor(overdueMin / 60);
      if (overdueHr < 24) return language === 'ar' ? `متأخر بـ ${overdueHr} س` : `Overdue by ${overdueHr}h`;
      const overdueDays = Math.floor(overdueHr / 24);
      return language === 'ar' ? `متأخر بـ ${overdueDays} يوم` : `Overdue by ${overdueDays}d`;
    }
    // Due in future
    if (diffSec < 60) return language === 'ar' ? `خلال ${diffSec} ث` : `Due in ${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return language === 'ar' ? `خلال ${diffMin} د` : `Due in ${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffHr < 24) return language === 'ar' ? `خلال ${diffHr} س ${remMin > 0 ? remMin + ' د' : ''}` : `Due in ${diffHr}h${remMin > 0 ? ' ' + remMin + 'm' : ''}`;
    const diffDays = Math.floor(diffHr / 24);
    return language === 'ar' ? `خلال ${diffDays} يوم` : `Due in ${diffDays}d`;
  };

  // Tick every 30s to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Error boundary effect
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('ReminderList - Global error caught:', event.error);
      setError('An unexpected error occurred. Please try again.');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <Button onClick={loadReminders} variant="outline" size="sm">
          {t('retry', language)}
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">{t('loadingReminders', language)}</p>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/5">
          <Calendar className="w-6 h-6 text-primary" />
        </div>
        <p className="text-sm mb-1 font-medium">{t('noReminders', language)}</p>
        <p className="text-xs max-w-xs">
          {language === 'ar'
            ? 'قم بإنشاء أول تذكير لك وسيظهر هنا مع التاريخ والوقت حتى لا تنسى.'
            : 'Create your first reminder and it will appear here with date and time so you never forget.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {reminders.map((reminder) => (
          <Card key={reminder.id} className={`transition-all hover:shadow-md ${isOverdue(reminder) ? 'border-red-200 bg-red-50/50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className={`font-medium text-sm ${isOverdue(reminder) ? 'text-red-700' : ''}`}>
                    {reminder.title}
                  </h3>
                  {reminder.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {reminder.description}
                    </p>
                  )}
                  {reminder.due_date && (
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{format(parseISO(reminder.due_date), 'MMM dd, yyyy')}</span>
                      </div>
                      {reminder.due_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{reminder.due_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Countdown */}
                  {(() => {
                    const countdown = getCountdownText(reminder);
                    if (!countdown) return null;
                    const overdue = isOverdue(reminder);
                    return (
                      <div className={`text-xs mt-1 font-medium ${overdue ? 'text-red-600' : 'text-primary'}`}>
                        {countdown}
                      </div>
                    );
                  })()}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-50">
                    <DropdownMenuItem onClick={() => handleEditReminder(reminder)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('edit', language)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSnoozeReminder(reminder)}>
                      <Pause className="h-4 w-4 mr-2" />
                      {t('snooze', language)}
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteClick(reminder)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('delete', language)}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!onReminderEdit && (
        <ReminderForm
          isOpen={isFormOpen}
          onClose={handleFormClose}
          reminder={editingReminder}
          onReminderSaved={handleReminderSaved}
        />
      )}

    </>
  );
};
