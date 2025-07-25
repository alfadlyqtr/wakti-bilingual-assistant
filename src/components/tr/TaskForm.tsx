
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { TRService, TRTask } from '@/services/trService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { CheckSquare, Trash2, Share2, Clock, Calendar } from 'lucide-react';

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task?: TRTask | null;
  onTaskSaved: () => void;
}

export function TaskForm({ isOpen, onClose, task, onTaskSaved }: TaskFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
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
      setFormData({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
        priority: 'normal',
        task_type: 'one-time',
        is_shared: false
      });
    }
  }, [task]);

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
      
      if (task) {
        await TRService.updateTask(task.id, formData);
        toast({
          title: t('success', language),
          description: t('taskUpdated', language)
        });
      } else {
        await TRService.createTask(formData, user.id);
        toast({
          title: t('success', language),
          description: t('taskCreated', language)
        });
      }

      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      toast({
        title: t('error', language),
        description: t('errorSavingTask', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;

    const confirmed = window.confirm(t('confirmDeleteTask', language));
    if (!confirmed) return;

    try {
      setLoading(true);
      await TRService.deleteTask(task.id);
      toast({
        title: t('success', language),
        description: t('taskDeleted', language)
      });
      onTaskSaved();
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: t('error', language),
        description: t('errorDeletingTask', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleComplete = async () => {
    if (!task) return;

    try {
      setLoading(true);
      await TRService.updateTask(task.id, { 
        completed: !task.completed,
        completed_at: !task.completed ? new Date().toISOString() : null
      });
      toast({
        title: t('success', language),
        description: task.completed ? t('taskReopened', language) : t('taskCompleted', language)
      });
      onTaskSaved();
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: t('error', language),
        description: t('errorUpdatingTask', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            {task ? t('editTask', language) : t('createTask', language)}
          </CardTitle>
          {task && (
            <div className="flex items-center gap-2">
              <Badge variant={task.completed ? 'default' : 'secondary'}>
                {task.completed ? t('completed', language) : t('pending', language)}
              </Badge>
              <Badge variant={task.priority === 'urgent' ? 'destructive' : task.priority === 'high' ? 'default' : 'secondary'}>
                {t(task.priority, language)}
              </Badge>
              {task.is_shared && (
                <Badge variant="outline">
                  <Share2 className="h-3 w-3 mr-1" />
                  {t('shared', language)}
                </Badge>
              )}
            </div>
          )}
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
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as 'normal' | 'high' | 'urgent' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="normal">{t('normal', language)}</option>
                  <option value="high">{t('high', language)}</option>
                  <option value="urgent">{t('urgent', language)}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="task_type">{t('type', language)}</Label>
                <select
                  id="task_type"
                  value={formData.task_type}
                  onChange={(e) => setFormData({ ...formData, task_type: e.target.value as 'one-time' | 'repeated' })}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="one-time">{t('oneTime', language)}</option>
                  <option value="repeated">{t('repeated', language)}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_shared"
                checked={formData.is_shared}
                onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
              />
              <Label htmlFor="is_shared">{t('makeShared', language)}</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? t('saving', language) : (task ? t('update', language) : t('create', language))}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                {t('cancel', language)}
              </Button>
              {task && (
                <>
                  <Button 
                    type="button" 
                    variant={task.completed ? 'outline' : 'default'} 
                    onClick={toggleComplete}
                    disabled={loading}
                  >
                    {task.completed ? t('reopen', language) : t('complete', language)}
                  </Button>
                  <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
