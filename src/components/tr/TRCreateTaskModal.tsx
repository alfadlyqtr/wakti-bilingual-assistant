
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
import { useToast } from '@/components/ui/use-toast';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Plus, X } from 'lucide-react';

interface TRCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSaved: () => void;
}

export function TRCreateTaskModal({ isOpen, onClose, onTaskSaved }: TRCreateTaskModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useTheme();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium',
    type: 'one-time',
    is_shared: false
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
      await TRService.createTask(formData, user.id);
      toast({
        title: t('success', language),
        description: t('taskCreated', language)
      });
      onTaskSaved();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium',
        type: 'one-time',
        is_shared: false
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: t('error', language),
        description: t('errorCreatingTask', language),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
                <Label htmlFor="priority">{t('priority', language)}</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('low', language)}</SelectItem>
                    <SelectItem value="medium">{t('medium', language)}</SelectItem>
                    <SelectItem value="high">{t('high', language)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="type">{t('type', language)}</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
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
                {loading ? t('creating', language) : t('create', language)}
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
