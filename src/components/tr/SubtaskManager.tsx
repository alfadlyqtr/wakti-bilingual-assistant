
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit3 } from 'lucide-react';
import { TRService, TRSubtask } from '@/services/trService';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface SubtaskManagerProps {
  taskId: string;
  onSubtasksChange?: () => void;
  readOnly?: boolean;
}

export const SubtaskManager: React.FC<SubtaskManagerProps> = ({ 
  taskId, 
  onSubtasksChange,
  readOnly = false 
}) => {
  const { language } = useTheme();
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      setLoading(true);
      const data = await TRService.getSubtasks(taskId);
      setSubtasks(data);
    } catch (error) {
      console.error('Error loading subtasks:', error);
      toast.error('Failed to load subtasks');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;

    try {
      await TRService.createSubtask({
        task_id: taskId,
        title: newSubtaskTitle.trim(),
        completed: false,
        order_index: subtasks.length
      });
      
      setNewSubtaskTitle('');
      await loadSubtasks();
      onSubtasksChange?.();
      toast.success('Subtask added');
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast.error('Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (id: string, completed: boolean) => {
    try {
      await TRService.updateSubtask(id, { completed });
      await loadSubtasks();
      onSubtasksChange?.();
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (id: string) => {
    try {
      await TRService.deleteSubtask(id);
      await loadSubtasks();
      onSubtasksChange?.();
      toast.success('Subtask deleted');
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast.error('Failed to delete subtask');
    }
  };

  const handleStartEdit = (subtask: TRSubtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const handleSaveEdit = async () => {
    if (!editingTitle.trim() || !editingId) return;

    try {
      await TRService.updateSubtask(editingId, { title: editingTitle.trim() });
      setEditingId(null);
      setEditingTitle('');
      await loadSubtasks();
      onSubtasksChange?.();
      toast.success('Subtask updated');
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading subtasks...</div>;
  }

  if (subtasks.length === 0 && readOnly) {
    return <div className="text-sm text-muted-foreground">No subtasks</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t('subtasks', language)} ({subtasks.length})</div>
      
      {subtasks.map((subtask) => (
        <div key={subtask.id} className="flex items-center gap-2 p-2 bg-secondary/20 rounded-md">
          <Checkbox
            checked={subtask.completed}
            onCheckedChange={(checked) => handleToggleSubtask(subtask.id, checked as boolean)}
            disabled={readOnly}
          />
          
          {editingId === subtask.id ? (
            <div className="flex-1 flex items-center gap-2">
              <Input
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="flex-1 h-8"
                autoFocus
              />
              <Button size="sm" onClick={handleSaveEdit} className="h-8 px-2">
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-2">
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                {subtask.title}
              </span>
              
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStartEdit(subtask)}
                    className="h-6 w-6 p-0"
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteSubtask(subtask.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {!readOnly && (
        <div className="relative">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
            placeholder="Enter subtask"
            className="pr-10"
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleAddSubtask}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
