
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Bell, Calendar, Clock, Edit2, Trash2, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { trService } from '@/services/trService';

interface Reminder {
  id: string;
  title: string;
  description: string;
  reminder_time: string;
  is_recurring: boolean;
  recurrence_pattern: string;
  is_active: boolean;
  created_at: string;
}

interface ReminderListProps {
  onEdit?: (reminder: Reminder) => void;
}

export function ReminderList({ onEdit }: ReminderListProps) {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchReminders();
    }
  }, [user?.id]);

  const fetchReminders = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await trService.getReminders(user.id);
      setReminders(data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (reminderId: string, isActive: boolean) => {
    if (!user?.id) return;

    try {
      await trService.updateReminder(user.id, reminderId, { is_active: isActive });
      setReminders(prev => 
        prev.map(reminder => 
          reminder.id === reminderId 
            ? { ...reminder, is_active: isActive }
            : reminder
        )
      );
      toast.success(isActive ? 'Reminder activated' : 'Reminder deactivated');
    } catch (error) {
      console.error('Error updating reminder:', error);
      toast.error('Failed to update reminder');
    }
  };

  const handleDelete = async (reminderId: string) => {
    if (!user?.id) return;

    try {
      await trService.deleteReminder(user.id, reminderId);
      setReminders(prev => prev.filter(reminder => reminder.id !== reminderId));
      toast.success('Reminder deleted');
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast.error('Failed to delete reminder');
    }
  };

  const formatReminderTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getRecurrenceText = (pattern: string) => {
    switch (pattern) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'monthly': return 'Monthly';
      case 'yearly': return 'Yearly';
      default: return 'Once';
    }
  };

  const isOverdue = (reminderTime: string) => {
    return new Date(reminderTime) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading reminders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Reminders
        </CardTitle>
        <CardDescription>
          {reminders.length} reminders total
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No reminders yet. Create your first reminder!
          </div>
        ) : (
          <div className="space-y-4">
            {reminders.map((reminder) => {
              const { date, time } = formatReminderTime(reminder.reminder_time);
              const overdue = isOverdue(reminder.reminder_time);
              
              return (
                <div key={reminder.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{reminder.title}</h3>
                        <div className="flex items-center gap-1">
                          {reminder.is_recurring && (
                            <Badge variant="secondary" className="text-xs">
                              <Repeat className="h-3 w-3 mr-1" />
                              {getRecurrenceText(reminder.recurrence_pattern)}
                            </Badge>
                          )}
                          {overdue && reminder.is_active && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                          {!reminder.is_active && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {reminder.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {reminder.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {date}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {time}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={reminder.is_active}
                        onCheckedChange={(checked) => handleToggleActive(reminder.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit?.(reminder)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(reminder.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
