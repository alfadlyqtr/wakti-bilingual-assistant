
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService } from '@/services/trService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Plus, X } from 'lucide-react';

interface TRCreateTaskModalProps {
  onClose: () => void;
  onTaskCreated: () => void;
}

export function TRCreateTaskModal({ onClose, onTaskCreated }: TRCreateTaskModalProps) {
  const { user } = useAuth();
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'normal',
    task_type: 'one-time',
    is_shared: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim()) {
      toast.error(t('titleRequired', language));
      return;
    }

    if (!formData.due_date) {
      toast.error(t('dueDateRequired', language));
      return;
    }

    try {
      setLoading(true);
      
      const taskData = {
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        due_time: formData.due_time || undefined,
        priority: formData.priority as 'normal' | 'high' | 'urgent',
        task_type: formData.task_type as 'one-time' | 'repeated',
        is_shared: formData.is_shared
      };

      await TRService.createTask(taskData, user.id);
      toast.success(t('taskCreated', language));
      onTaskCreated();
      onClose();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(t('errorCreatingTask', language));
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
              <Plus className="h-5 w-5" />
              {t('createTask', language)}
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
                placeholder={t('enterTaskTitle', language)}
                required
              />
            </div>

            <div>
              <Label htmlFor="description">{t('description', language)}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={t('enterTaskDescription', language)}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">{t('priority', language)}</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
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
              <div>
                <Label htmlFor="task_type">{t('taskType', language)}</Label>
                <Select value={formData.task_type} onValueChange={(value) => setFormData({ ...formData, task_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                    <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_shared">{t('makeShared', language)}</Label>
              <Switch
                id="is_shared"
                checked={formData.is_shared}
                onCheckedChange={(checked) => setFormData({ ...formData, is_shared: checked })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('creating', language) : t('createTask', language)}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel', language)}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
