
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask } from '@/services/trService';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TRTask | null;
  onTaskSaved?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ 
  isOpen, 
  onClose, 
  task, 
  onTaskSaved 
}) => {
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'normal' as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as 'one-time' | 'repeated',
    is_shared: false
  });

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title,
        description: task.description || '',
        due_date: task.due_date,
        due_time: task.due_time || '',
        priority: task.priority,
        task_type: task.task_type,
        is_shared: task.is_shared
      });
    } else {
      // Reset form for new task
      setFormData({
        title: '',
        description: '',
        due_date: format(new Date(), 'yyyy-MM-dd'),
        due_time: '',
        priority: 'normal',
        task_type: 'one-time',
        is_shared: false
      });
    }
  }, [task, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.due_date) return;

    setLoading(true);
    try {
      if (task) {
        await TRService.updateTask(task.id, formData);
        toast.success(t('taskUpdated', language));
      } else {
        await TRService.createTask(formData);
        toast.success(t('taskCreated', language));
      }
      onTaskSaved?.();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      toast.error('Error saving task');
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {task ? t('editTask', language) : t('createTask', language)}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="title">{t('taskTitle', language)} *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('enterTaskTitle', language)}
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

          {/* Priority */}
          <div className="space-y-2">
            <Label>{t('priority', language)}</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value) => setFormData({ ...formData, priority: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t('normal', language)}</SelectItem>
                <SelectItem value="high">{t('high', language)}</SelectItem>
                <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Task Type */}
          <div className="space-y-2">
            <Label>{t('taskType', language)}</Label>
            <Select 
              value={formData.task_type} 
              onValueChange={(value) => setFormData({ ...formData, task_type: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Share Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="is_shared">{t('shareTask', language)}</Label>
            <Switch
              id="is_shared"
              checked={formData.is_shared}
              onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={loading || !formData.title.trim() || !formData.due_date} className="flex-1">
              {loading ? 'Saving...' : t('save', language)}
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
