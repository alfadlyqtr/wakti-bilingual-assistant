
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService, TRReminder } from '@/services/trService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Edit, X, Trash2 } from 'lucide-react';

interface ReminderFormProps {
  reminder?: TRReminder;
  onClose: () => void;
  onReminderSaved: () => void;
}

export function ReminderForm({ reminder, onClose, onReminderSaved }: ReminderFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: reminder?.title || '',
    description: reminder?.description || '',
    due_date: reminder?.due_date || '',
    due_time: reminder?.due_time || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim()) {
      toast({
        title: t('error', language),
        description: t('titleRequired', language),
        variant: 'destructive'
      });
      return;
    }

    if (!formData.due_date) {
      toast({
        title: t('error', language),
        description: t('dueDateRequired', language),
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      const reminderData = {
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        due_time: formData.due_time || null
      };

      if (reminder) {
        await TRService.updateReminder(reminder.id, reminderData);
        toast({
          title: t('success', language),
          description: t('reminderUpdated', language)
        });
      } else {
        await TRService.createReminder(reminderData, user.id);
        toast({
          title: t('success', language),
          description: t('reminderCreated', language)
        });
      }
      
      onReminderSaved();
      onClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorSavingReminder', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reminder) return;

    try {
      setLoading(true);
      await TRService.deleteReminder(reminder.id);
      toast({
        title: t('success', language),
        description: t('reminderDeleted', language)
      });
      onReminderSaved();
      onClose();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingReminder', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              {reminder ? t('editReminder', language) : t('createReminder', language)}
            </span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">{t('title', language)} *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('enterReminderTitle', language)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">{t('description', language)}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('enterReminderDescription', language)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="due_date">{t('dueDate', language)} *</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="due_time">{t('dueTime', language)}</Label>
                <Input
                  id="due_time"
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('saving', language) : (reminder ? t('update', language) : t('create', language))}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel', language)}
              </Button>
              {reminder && (
                <Button 
                  type="button" 
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t('delete', language)}
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
