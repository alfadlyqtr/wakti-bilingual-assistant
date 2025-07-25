
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TRReminder, TRService } from '@/services/trService';
import { ReminderForm } from './ReminderForm';
import { format, parseISO, isAfter } from 'date-fns';
import { Timer, Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface ReminderListProps {
  reminders: TRReminder[];
  onRemindersUpdated: () => void;
}

export function ReminderList({ reminders, onRemindersUpdated }: ReminderListProps) {
  const { toast } = useToast();
  const { language } = useTheme();
  const [editingReminder, setEditingReminder] = useState<TRReminder | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleSnooze = async (reminder: TRReminder) => {
    try {
      await TRService.snoozeReminder(reminder.id);
      toast({
        title: t('success', language),
        description: t('reminderSnoozed', language)
      });
      onRemindersUpdated();
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorSnoozingReminder', language),
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (reminder: TRReminder) => {
    if (!confirm(t('confirmDeleteReminder', language))) return;
    
    try {
      await TRService.deleteReminder(reminder.id);
      toast({
        title: t('success', language),
        description: t('reminderDeleted', language)
      });
      onRemindersUpdated();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingReminder', language),
        variant: 'destructive'
      });
    }
  };

  const isOverdue = (reminder: TRReminder) => {
    const now = new Date();
    const dueDateTime = reminder.due_time 
      ? parseISO(`${reminder.due_date}T${reminder.due_time}`)
      : parseISO(`${reminder.due_date}T23:59:59`);
    return isAfter(now, dueDateTime);
  };

  const isSnoozed = (reminder: TRReminder) => {
    if (!reminder.snoozed_until) return false;
    const now = new Date();
    const snoozeUntil = parseISO(reminder.snoozed_until);
    return isAfter(snoozeUntil, now);
  };

  const activeReminders = reminders.filter(r => !isSnoozed(r));
  const snoozedReminders = reminders.filter(r => isSnoozed(r));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{t('reminders', language)}</span>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('addReminder', language)}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeReminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('noReminders', language)}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setShowCreateForm(true)}
              >
                {t('createFirstReminder', language)}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {activeReminders.map((reminder) => (
                <div key={reminder.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {reminder.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={isOverdue(reminder) ? 'destructive' : 'secondary'}>
                          {isOverdue(reminder) ? t('overdue', language) : t('upcoming', language)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(reminder.due_date), 'MMM dd, yyyy')}
                          {reminder.due_time && ` at ${reminder.due_time}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSnooze(reminder)}
                      >
                        <Timer className="h-4 w-4 mr-1" />
                        {t('snooze', language)}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingReminder(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(reminder)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {snoozedReminders.length > 0 && (
            <div className="mt-8">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Timer className="h-5 w-5" />
                {t('snoozed', language)} ({snoozedReminders.length})
              </h3>
              <div className="space-y-2">
                {snoozedReminders.map((reminder) => (
                  <div key={reminder.id} className="border rounded-lg p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{reminder.title}</h4>
                        <p className="text-sm text-muted-foreground">
                          {t('snoozedUntil', language)}: {format(parseISO(reminder.snoozed_until!), 'MMM dd, yyyy')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingReminder(reminder)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreateForm && (
        <ReminderForm
          onClose={() => setShowCreateForm(false)}
          onReminderSaved={() => {
            setShowCreateForm(false);
            onRemindersUpdated();
          }}
        />
      )}

      {editingReminder && (
        <ReminderForm
          reminder={editingReminder}
          onClose={() => setEditingReminder(null)}
          onReminderSaved={() => {
            setEditingReminder(null);
            onRemindersUpdated();
          }}
        />
      )}
    </>
  );
}
