
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Calendar, Clock, Edit, Trash2, Snooze } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { ReminderForm } from './ReminderForm';
import { toast } from 'sonner';

interface ReminderListProps {
  onReminderUpdate?: () => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ onReminderUpdate }) => {
  const { language } = useTheme();
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingReminder, setEditingReminder] = useState<TRReminder | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    loadReminders();
  }, []);

  const loadReminders = async () => {
    try {
      setLoading(true);
      const data = await TRService.getReminders();
      
      // Filter out snoozed reminders
      const now = new Date();
      const activeReminders = data.filter(reminder => {
        if (!reminder.snoozed_until) return true;
        return parseISO(reminder.snoozed_until) <= now;
      });
      
      setReminders(activeReminders);
    } catch (error) {
      console.error('Error loading reminders:', error);
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleEditReminder = (reminder: TRReminder) => {
    setEditingReminder(reminder);
    setIsFormOpen(true);
  };

  const handleSnoozeReminder = async (reminder: TRReminder) => {
    try {
      await TRService.snoozeReminder(reminder.id);
      toast.success('Reminder snoozed for 1 day');
      loadReminders();
      onReminderUpdate?.();
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      toast.error('Failed to snooze reminder');
    }
  };

  const handleDeleteReminder = async (reminder: TRReminder) => {
    if (window.confirm('Are you sure you want to delete this reminder?')) {
      try {
        await TRService.deleteReminder(reminder.id);
        toast.success(t('reminderDeleted', language));
        loadReminders();
        onReminderUpdate?.();
      } catch (error) {
        console.error('Error deleting reminder:', error);
        toast.error('Failed to delete reminder');
      }
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingReminder(null);
  };

  const handleReminderSaved = () => {
    loadReminders();
    onReminderUpdate?.();
  };

  const isOverdue = (reminder: TRReminder) => {
    const reminderDate = parseISO(reminder.due_date);
    if (reminder.due_time) {
      const [hours, minutes] = reminder.due_time.split(':');
      reminderDate.setHours(parseInt(hours), parseInt(minutes));
    }
    return isPast(reminderDate);
  };

  if (loading) {
    return <div className="text-center py-8">{t('loading', language)}</div>;
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('noReminders', language)}
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
                    {isOverdue(reminder) && (
                      <span className="text-red-600 font-medium">Overdue</span>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditReminder(reminder)}>
                      <Edit className="h-4 w-4 mr-2" />
                      {t('edit', language)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSnoozeReminder(reminder)}>
                      <Snooze className="h-4 w-4 mr-2" />
                      Snooze
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteReminder(reminder)}
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

      <ReminderForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        reminder={editingReminder}
        onReminderSaved={handleReminderSaved}
      />
    </>
  );
};
