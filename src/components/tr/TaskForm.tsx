
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService, TRTask } from '@/services/trService';
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
import { Edit, X, RotateCcw, Check } from 'lucide-react';

interface TaskFormProps {
  isOpen: boolean;
  task: TRTask | null;
  onClose: () => void;
  onTaskSaved: () => void;
}

export function TaskForm({ isOpen, task, onClose, onTaskSaved }: TaskFormProps) {
  // Early return BEFORE any hooks are called
  if (!isOpen || !task) return null;

  const { user } = useAuth();
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    due_date: task.due_date || '',
    priority: task.priority || 'normal',
    type: task.task_type || 'one-time',
    is_shared: task.is_shared || false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !task) return;

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
      
      const updateData = {
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date,
        priority: formData.priority as 'normal' | 'high' | 'urgent',
        task_type: formData.type as 'one-time' | 'repeated',
        is_shared: formData.is_shared
      };

      await TRService.updateTask(task.id, updateData);
      toast.success(t('taskUpdated', language));
      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('errorSavingTask', language));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async () => {
    if (!task) return;
    
    try {
      setLoading(true);
      
      const updateData = {
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null
      };

      await TRService.updateTask(task.id, updateData);
      toast.success(task.completed ? t('taskReopened', language) : t('taskCompleted', language));
      
      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error toggling task completion:', error);
      toast.error(t('errorUpdatingTask', language));
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
              {t('editTask', language)}
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
                <Label htmlFor="priority">{t('priority', language)}</Label>
                <Select value={formData.priority} onValueChange={(value: 'normal' | 'high' | 'urgent') => setFormData({ ...formData, priority: value })}>
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
            </div>

            <div>
              <Label htmlFor="type">{t('taskType', language)}</Label>
              <Select value={formData.type} onValueChange={(value: 'one-time' | 'repeated') => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                  <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
                </SelectContent>
              </Select>
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
                {loading ? t('saving', language) : t('update', language)}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel', language)}
              </Button>
              <Button 
                type="button" 
                variant={task.completed ? "secondary" : "default"}
                onClick={handleToggleComplete}
                disabled={loading}
              >
                {task.completed ? (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    {t('reopen', language)}
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {t('complete', language)}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
