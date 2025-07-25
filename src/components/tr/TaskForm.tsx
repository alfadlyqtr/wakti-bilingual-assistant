
import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { trService } from '@/services/trService';

interface TaskFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TaskForm({ onSuccess, onCancel }: TaskFormProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: '',
    due_time: '',
    is_shareable: false,
    tags: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    if (!formData.title.trim()) {
      toast.error('Please enter a task title');
      return;
    }

    try {
      setLoading(true);
      
      // Combine date and time if both provided
      let dueDate = null;
      if (formData.due_date) {
        dueDate = formData.due_time 
          ? `${formData.due_date}T${formData.due_time}:00`
          : `${formData.due_date}T23:59:59`;
      }
      
      const taskData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        due_date: dueDate,
        is_shareable: formData.is_shareable,
        tags: formData.tags,
      };

      await trService.createTask(user.id, taskData);
      
      toast.success('Task created successfully');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        priority: 'medium',
        due_date: '',
        due_time: '',
        is_shareable: false,
        tags: [],
      });
      
      onSuccess?.();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error('Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5" />
          New Task
        </CardTitle>
        <CardDescription>
          Create a new task to add to your to-do list
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter task title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter task description (optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_time">Due Time</Label>
              <Input
                id="due_time"
                type="time"
                value={formData.due_time}
                onChange={(e) => setFormData(prev => ({ ...prev, due_time: e.target.value }))}
                disabled={!formData.due_date}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                placeholder="Add a tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="is_shareable"
                checked={formData.is_shareable}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_shareable: checked }))}
              />
              <Label htmlFor="is_shareable">Make task shareable</Label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
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
