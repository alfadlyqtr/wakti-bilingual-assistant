
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreVertical, Calendar, Clock, Edit, Trash2, Pause, Timer, AlarmClock, CheckCircle2 } from 'lucide-react';
import { format, isPast, parseISO, differenceInSeconds, differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { ReminderForm } from './ReminderForm';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const triggeredReminders = useRef<Set<string>>(new Set()); // Track which reminders we've already triggered
  const [snoozeReminderId, setSnoozeReminderId] = useState<string | null>(null); // For snooze popover
  const [deleteTarget, setDeleteTarget] = useState<TRReminder | null>(null);


  useEffect(() => {
    if (propReminders) {
      // Show all reminders (no filtering)
      setReminders(propReminders);
      setLoading(false);
      setError('');
    } else {
      loadReminders();
    }
  }, [propReminders]);

  const loadReminders = async () => {
    try {
      setLoading(true);
      setError('');
      
      const data = await TRService.getReminders();
      // Show all reminders (no filtering)
      setReminders(data);
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
    
    if (onReminderEdit) {
      onReminderEdit(reminder);
    } else {
      setEditingReminder(reminder);
      setIsFormOpen(true);
    }
  };

  const handleSnoozeReminder = async (reminderId: string, minutes: number) => {
    try {
      await TRService.snoozeReminder(reminderId, minutes);
      const snoozeMsg = language === 'ar' 
        ? `تم تأجيل التذكير ${minutes} دقيقة ⏰`
        : `Snoozed for ${minutes}min ⏰`;
      toast.success(snoozeMsg);
      setSnoozeReminderId(null);
      
      if (onRemindersChanged) {
        onRemindersChanged();
      } else {
        loadReminders();
      }
      onReminderUpdate?.();
    } catch (error) {
      console.error('ReminderList - Error snoozing reminder:', error);
      toast.error(language === 'ar' ? 'فشل تأجيل التذكير' : 'Failed to snooze reminder');
    }
  };

  const handleMarkDone = async (reminder: TRReminder) => {
    try {
      await TRService.deleteReminder(reminder.id);
      const doneMsg = language === 'ar' ? 'تم إكمال التذكير ✓' : 'Reminder completed ✓';
      toast.success(doneMsg);
      
      if (onRemindersChanged) {
        onRemindersChanged();
      } else {
        loadReminders();
      }
      onReminderUpdate?.();
    } catch (error) {
      console.error('ReminderList - Error marking reminder done:', error);
      toast.error(language === 'ar' ? 'فشل إكمال التذكير' : 'Failed to complete reminder');
    }
  };

  // Snooze time presets
  const snoozePresets = [
    { label: language === 'ar' ? '1 د' : '1m', minutes: 1 },
    { label: language === 'ar' ? '5 د' : '5m', minutes: 5 },
    { label: language === 'ar' ? '10 د' : '10m', minutes: 10 },
    { label: language === 'ar' ? '15 د' : '15m', minutes: 15 },
    { label: language === 'ar' ? '30 د' : '30m', minutes: 30 },
    { label: language === 'ar' ? '1 س' : '1h', minutes: 60 },
  ];

  const handleDeleteClick = (reminder: TRReminder) => {
    setDeleteTarget(reminder);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const idToDelete = deleteTarget.id;
    // Close dialog FIRST to remove portal overlay before potential unmount
    setDeleteTarget(null);
    try {
      await TRService.deleteReminder(idToDelete);
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
    setIsFormOpen(false);
    setEditingReminder(null);
  };

  const handleReminderSaved = () => {
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

  // Trigger instant notification for a reminder that just became due
  const triggerInstantNotification = async (reminder: TRReminder) => {
    // Don't trigger if we've already triggered this reminder
    if (triggeredReminders.current.has(reminder.id)) return;
    triggeredReminders.current.add(reminder.id);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Create notification entry - this will trigger the instant_push_trigger
      // Using type assertion because TS types may be out of sync with actual DB schema
      const { error } = await (supabase
        .from('notification_history') as any)
        .insert({
          user_id: user.id,
          type: 'reminder_due',
          title: 'Reminder',
          body: reminder.title,
          data: {
            reminder_id: reminder.id,
            due_date: reminder.due_date,
            due_time: reminder.due_time
          },
          deep_link: '/tr'
        });
      
      if (error) {
        // Check if it's a duplicate (already notified by cron)
        if (!error.message?.includes('duplicate')) {
          console.error('Error triggering instant notification:', error);
        }
      } else {
        // Mark as notified in the reminders table
        await (supabase
          .from('tr_reminders') as any)
          .update({ notified_at: new Date().toISOString() })
          .eq('id', reminder.id);
      }
    } catch (err) {
      console.error('Error in triggerInstantNotification:', err);
    }
  };

  // Tick every 1s to update countdowns and check for due reminders
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      
      // Check each reminder to see if it just became due
      reminders.forEach(reminder => {
        if (!reminder.due_date || !reminder.due_time) return;
        if (reminder.notified_at) return; // Already notified
        
        try {
          const reminderDate = parseISO(reminder.due_date);
          const [hours, minutes] = reminder.due_time.split(':');
          reminderDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const now = new Date();
          const diffSec = differenceInSeconds(reminderDate, now);
          
          // If reminder just became due (within last 2 seconds), trigger instant notification
          if (diffSec <= 0 && diffSec > -2) {
            triggerInstantNotification(reminder);
          }
        } catch (err) {
          // Ignore parse errors
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

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
              {/* Header: Title + Menu */}
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className={`font-medium text-sm flex-1 ${isOverdue(reminder) ? 'text-red-700' : ''}`}>
                  {reminder.title}
                </h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-50">
                    <DropdownMenuItem onClick={() => handleEditReminder(reminder)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('edit', language)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSnoozeReminderId(reminder.id)}>
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

              {/* Description */}
              {reminder.description && (
                <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                  {reminder.description}
                </p>
              )}

              {/* Date & Time */}
              {reminder.due_date && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

              {/* Countdown + Done Button Row */}
              <div className="flex items-center justify-between mt-3 gap-2">
                {/* Countdown Badge */}
                {(() => {
                  const countdown = getCountdownText(reminder);
                  if (!countdown) return <div />;
                  const overdue = isOverdue(reminder);
                  const dt = getReminderDateTime(reminder);
                  const isUrgent = dt && !overdue && differenceInMinutes(dt, new Date()) <= 5;
                  
                  return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                      overdue 
                        ? 'bg-red-100 text-red-700 animate-pulse' 
                        : isUrgent 
                          ? 'bg-orange-100 text-orange-700 animate-pulse'
                          : 'bg-primary/10 text-primary'
                    }`}>
                      {overdue ? (
                        <AlarmClock className="h-3.5 w-3.5" />
                      ) : (
                        <Timer className="h-3.5 w-3.5" />
                      )}
                      <span>{countdown}</span>
                    </div>
                  );
                })()}

                {/* Beautiful Done Button */}
                <Button
                  size="sm"
                  className="h-8 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600 shadow-md hover:shadow-lg transition-all duration-200 font-medium text-xs"
                  onClick={() => handleMarkDone(reminder)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  {language === 'ar' ? 'تم' : 'Done'}
                </Button>
              </div>

              {/* Snooze Time Chips */}
              {snoozeReminderId === reminder.id && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    {language === 'ar' ? 'تأجيل لمدة:' : 'Snooze for:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {snoozePresets.map((preset) => (
                      <Button
                        key={preset.minutes}
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px] px-3 rounded-full bg-gradient-to-r from-primary/80 to-primary text-primary-foreground hover:from-primary hover:to-primary shadow-sm"
                        onClick={() => handleSnoozeReminder(reminder.id, preset.minutes)}
                      >
                        {preset.label}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] px-2 text-muted-foreground"
                      onClick={() => setSnoozeReminderId(null)}
                    >
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Button>
                  </div>
                </div>
              )}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'ar' ? 'حذف التذكير' : 'Delete Reminder'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'ar'
                ? `هل أنت متأكد أنك تريد حذف "${deleteTarget?.title}"؟`
                : `Are you sure you want to delete "${deleteTarget?.title}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'ar' ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {language === 'ar' ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};
