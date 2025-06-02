
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MoreHorizontal, Edit, Trash2, Clock } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface ReminderListProps {
  reminders: TRReminder[];
  onReminderEdit: (reminder: TRReminder) => void;
  onRemindersChanged: () => void;
}

export const ReminderList: React.FC<ReminderListProps> = ({ 
  reminders, 
  onReminderEdit, 
  onRemindersChanged 
}) => {
  const { language } = useTheme();

  const handleDeleteReminder = async (reminder: TRReminder) => {
    if (confirm('Are you sure you want to delete this reminder?')) {
      try {
        await TRService.deleteReminder(reminder.id);
        toast.success(t('reminderDeleted', language));
        onRemindersChanged();
      } catch (error) {
        console.error('Error deleting reminder:', error);
        toast.error('Error deleting reminder');
      }
    }
  };

  if (reminders.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t('noReminders', language)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((reminder) => (
        <Card key={reminder.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{reminder.title}</h3>
                
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {format(parseISO(reminder.due_date), 'MMM dd, yyyy')}
                    {reminder.due_time && ` at ${reminder.due_time}`}
                  </span>
                </div>

                {reminder.description && (
                  <p className="text-sm text-muted-foreground mt-2">{reminder.description}</p>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onReminderEdit(reminder)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t('edit', language)}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleDeleteReminder(reminder)}
                    className="text-destructive"
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
  );
};
