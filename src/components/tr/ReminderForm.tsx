
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { trService } from '@/services/trService';

interface ReminderFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReminderForm({ onSuccess, onCancel }: ReminderFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminder_time: '',
    reminder_date: '',
    is_recurring: false,
    recurrence_pattern: 'daily',
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.reminder_date || !formData.reminder_time) {
      toast.error('Please select date and time');
      return;
    }

    try {
      setLoading(true);
      
      // Combine date and time
      const reminderDateTime = `${formData.reminder_date}T${formData.reminder_time}:00`;
      
      const reminderData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        reminder_time: reminderDateTime,
        is_recurring: formData.is_recurring,
        recurrence_pattern: formData.is_recurring ? formData.recurrence_pattern : null,
        is_active: formData.is_active,
      };

      await trService.createReminder(user.id, reminderData);
      
      toast.success('Reminder created successfully');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        reminder_time: '',
        reminder_date: '',
        is_recurring: false,
        recurrence_pattern: 'daily',
        is_active: true,
      });
      
      onSuccess?.();
    } catch (error) {
      console.error('Error creating reminder:', error);
      toast.error('Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          New Reminder
        </CardTitle>
        <CardDescription>
          Create a new reminder to keep track of important events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter reminder title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter reminder description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reminder_date">Date *</Label>
              <Input
                id="reminder_date"
                type="date"
                value={formData.reminder_date}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder_time">Time *</Label>
              <Input
                id="reminder_time"
                type="time"
                value={formData.reminder_time}
                onChange={(e) => setFormData(prev => ({ ...prev, reminder_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_recurring"
                checked={formData.is_recurring}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_recurring: checked }))}
              />
              <Label htmlFor="is_recurring">Recurring reminder</Label>
            </div>
          </div>

          {formData.is_recurring && (
            <div className="space-y-2">
              <Label htmlFor="recurrence_pattern">Recurrence Pattern</Label>
              <Select
                value={formData.recurrence_pattern}
                onValueChange={(value) => setFormData(prev => ({ ...prev, recurrence_pattern: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Active reminder</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Create Reminder
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
