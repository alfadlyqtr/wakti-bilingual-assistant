import React, { useState } from 'react';
import { TRService, TRReminder } from '@/services/trService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Bell, Clock, Calendar, Timer, Trash2, Edit, Check } from 'lucide-react';
import { format } from 'date-fns';

interface ReminderListProps {
  reminders: TRReminder[];
  onReminderEdit: (reminder: TRReminder) => void;
  onRemindersChanged: () => void;
}

export function ReminderList({ reminders, onReminderEdit, onRemindersChanged }: ReminderListProps) {
  const { toast } = useToast();
  const { language } = useTheme();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSnooze = async (reminder: TRReminder) => {
    try {
      setLoading(reminder.id);
      await TRService.snoozeReminder(reminder.id);
      toast({
        title: t('success', language),
        description: t('reminderSnoozed', language)
      });
      onRemindersChanged();
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorSnoozingReminder', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (reminder: TRReminder) => {
    const confirmed = window.confirm(t('confirmDeleteReminder', language));
    if (!confirmed) return;

    try {
      setLoading(reminder.id);
      await TRService.deleteReminder(reminder.id);
      toast({
        title: t('success', language),
        description: t('reminderDeleted', language)
      });
      onRemindersChanged();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingReminder', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return format(date, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const isOverdue = (reminder: TRReminder) => {
    const now = new Date();
    const dueDate = new Date(reminder.due_date);
    
    if (reminder.due_time) {
      const [hours, minutes] = reminder.due_time.split(':');
      dueDate.setHours(parseInt(hours), parseInt(minutes));
    }
    
    return dueDate < now;
  };

  const isSnoozed = (reminder: TRReminder) => {
    if (!reminder.snoozed_until) return false;
    return new Date(reminder.snoozed_until) > new Date();
  };

  if (reminders.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">{t('noReminders', language)}</p>
          <p className="text-sm text-muted-foreground">{t('createFirstReminder', language)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <Card key={reminder.id} className={`${isOverdue(reminder) ? 'border-red-200 bg-red-50/50' : ''}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium">{reminder.title}</h3>
                  {isSnoozed(reminder) && (
                    <Badge variant="secondary" className="text-xs">
                      <Timer className="h-3 w-3 mr-1" />
                      {t('snoozed', language)}
                    </Badge>
                  )}
                  {isOverdue(reminder) && (
                    <Badge variant="destructive" className="text-xs">
                      {t('overdue', language)}
                    </Badge>
                  )}
                </div>
                
                {reminder.description && (
                  <p className="text-sm text-muted-foreground mb-2">{reminder.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(reminder.due_date)}
                  </div>
                  {reminder.due_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTime(reminder.due_time)}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReminderEdit(reminder)}
                  disabled={loading === reminder.id}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSnooze(reminder)}
                  disabled={loading === reminder.id}
                >
                  <Timer className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(reminder)}
                  disabled={loading === reminder.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
