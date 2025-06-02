
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRReminder } from '@/services/trService';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ReminderFormProps {
  isOpen: boolean;
  onClose: () => void;
  reminder?: TRReminder | null;
  onReminderSaved?: () => void;
}

export const ReminderForm: React.FC<ReminderFormProps> = ({ 
  isOpen, 
  onClose, 
  reminder, 
  onReminderSaved 
}) => {
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    recurring: false,
    recurrence: 'weekly' as 'daily' | 'weekly' | 'monthly'
  });

  useEffect(() => {
    if (reminder) {
      setFormData({
        title: reminder.title,
        description: reminder.description || '',
        due_date: reminder.due_date,
        due_time: reminder.due_time || '',
        recurring: false,
        recurrence: 'weekly'
      });
    } else {
      // Reset form for new reminder
      setFormData({
        title: '',
        description: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        due_time: '',
        recurring: false,
        recurrence: 'weekly'
      });
    }
  }, [reminder, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.due_date) return;

    setLoading(true);
    try {
      const reminderData = {
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        due_time: formData.due_time
      };

      if (reminder) {
        // For existing reminders, only update date and time
        await TRService.updateReminder(reminder.id, {
          due_date: formData.due_date,
          due_time: formData.due_time
        });
        toast.success(t('reminderUpdated', language));
      } else {
        await TRService.createReminder(reminderData);
        toast.success(t('reminderCreated', language));
      }
      onReminderSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast.error('Error saving reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {reminder ? (
              <>
                <span>{t('editReminder', language)}</span>
                <span className="text-blue-600 font-medium">"{reminder.title}"</span>
              </>
            ) : (
              t('createReminder', language)
            )}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Show title and description fields only for new reminders */}
          {!reminder && (
            <>
              {/* Reminder Title */}
              <div className="space-y-2">
                <Label htmlFor="title">{t('reminderTitle', language)} *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder={t('enterReminderTitle', language)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">{t('description', language)} ({t('optional', language)})</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t('enterDescription', language)}
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="due_date">{t('dueDate', language)} *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_time">{t('dueTime', language)} ({t('optional', language)})</Label>
              <Input
                id="due_time"
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
              />
            </div>
          </div>

          {/* Show recurring options only for new reminders */}
          {!reminder && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  id="recurring"
                  type="checkbox"
                  checked={formData.recurring}
                  onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="recurring">{t('recurring', language)}</Label>
                
                {/* Inline Recurrence Options */}
                {formData.recurring && (
                  <div className="flex items-center space-x-4 ml-4">
                    <label className="flex items-center space-x-1">
                      <input
                        type="radio"
                        name="recurrence"
                        value="daily"
                        checked={formData.recurrence === 'daily'}
                        onChange={(e) => setFormData({ ...formData, recurrence: 'daily' })}
                        className="text-primary"
                      />
                      <span className="text-sm">Daily</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="radio"
                        name="recurrence"
                        value="weekly"
                        checked={formData.recurrence === 'weekly'}
                        onChange={(e) => setFormData({ ...formData, recurrence: 'weekly' })}
                        className="text-primary"
                      />
                      <span className="text-sm">Weekly</span>
                    </label>
                    <label className="flex items-center space-x-1">
                      <input
                        type="radio"
                        name="recurrence"
                        value="monthly"
                        checked={formData.recurrence === 'monthly'}
                        onChange={(e) => setFormData({ ...formData, recurrence: 'monthly' })}
                        className="text-primary"
                      />
                      <span className="text-sm">Monthly</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={loading || (!reminder && (!formData.title.trim() || !formData.due_date)) || (reminder && !formData.due_date)} 
              className="flex-1"
            >
              {loading ? 'Saving...' : reminder ? t('save', language) : t('create', language)}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
              {t('cancel', language)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
