
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TRService } from '@/services/trService';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { toast } from 'sonner';

interface TRCreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

export const TRCreateTaskModal: React.FC<TRCreateTaskModalProps> = ({
  isOpen,
  onClose,
  onTaskCreated
}) => {
  const { language } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: '',
    due_time: '',
    priority: 'normal' as 'normal' | 'high' | 'urgent',
    task_type: 'one-time' as 'one-time' | 'repeated',
    is_shared: false
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.due_date) {
      toast.error('Due date is required');
      return;
    }

    setIsLoading(true);
    
    try {
      await TRService.createTask({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        due_date: formData.due_date,
        due_time: formData.due_time || undefined,
        priority: formData.priority,
        task_type: formData.task_type,
        is_shared: formData.is_shared
      });
      
      toast.success(t('taskCreatedSuccessfully', language));
      onTaskCreated();
      onClose();
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        due_date: '',
        due_time: '',
        priority: 'normal',
        task_type: 'one-time',
        is_shared: false
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(t('failedToCreateTask', language));
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('createTask', language)}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('title', language)} *</Label>
            <Input
              id="title"
              placeholder={t('enterTaskTitle', language)}
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">{t('description', language)}</Label>
            <Textarea
              id="description"
              placeholder={t('enterTaskDescription', language)}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">{t('dueDate', language)} *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange('due_date', e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="due_time">{t('dueTime', language)}</Label>
              <Input
                id="due_time"
                type="time"
                value={formData.due_time}
                onChange={(e) => handleChange('due_time', e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>{t('priority', language)}</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => handleChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectPriority', language)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">{t('normal', language)}</SelectItem>
                <SelectItem value="high">{t('high', language)}</SelectItem>
                <SelectItem value="urgent">{t('urgent', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>{t('taskType', language)}</Label>
            <Select
              value={formData.task_type}
              onValueChange={(value) => handleChange('task_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectTaskType', language)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">{t('oneTime', language)}</SelectItem>
                <SelectItem value="repeated">{t('repeated', language)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="is_shared"
              checked={formData.is_shared}
              onCheckedChange={(checked) => handleChange('is_shared', checked)}
            />
            <Label htmlFor="is_shared">{t('shareTask', language)}</Label>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              {t('cancel', language)}
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? t('creating', language) : t('create', language)}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
