import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRSubtask } from '@/services/trService';
import { toast } from 'sonner';

interface SubtaskManagerProps {
  taskId: string;
  isShared?: boolean;
  onSubtasksChange?: (subtasks: TRSubtask[]) => void;
}

export const SubtaskManager: React.FC<SubtaskManagerProps> = ({ 
  taskId, 
  isShared = false,
  onSubtasksChange 
}) => {
  const { language } = useTheme();
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  const loadSubtasks = async () => {
    try {
      const data = await TRService.getSubtasks(taskId);
      setSubtasks(data);
      onSubtasksChange?.(data);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    
    setLoading(true);
    try {
      const newSubtask = await TRService.createSubtask({
        task_id: taskId,
        title: newSubtaskTitle.trim(),
        completed: false,
        order_index: subtasks.length
      });
      
      const updatedSubtasks = [...subtasks, newSubtask];
      setSubtasks(updatedSubtasks);
      setNewSubtaskTitle('');
      onSubtasksChange?.(updatedSubtasks);
      toast.success(t('subtaskAdded', language));
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast.error('Error adding subtask');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSubtask = async (id: string, completed: boolean) => {
    try {
      await TRService.updateSubtask(id, { completed });
      const updatedSubtasks = subtasks.map(st => 
        st.id === id ? { ...st, completed } : st
      );
      setSubtasks(updatedSubtasks);
      onSubtasksChange?.(updatedSubtasks);
      toast.success(t('subtaskUpdated', language));
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast.error('Error updating subtask');
    }
  };

  const handleEditSubtask = (subtask: TRSubtask) => {
    setEditingId(subtask.id);
    setEditingTitle(subtask.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTitle.trim()) return;
    
    try {
      await TRService.updateSubtask(editingId, { title: editingTitle.trim() });
      const updatedSubtasks = subtasks.map(st => 
        st.id === editingId ? { ...st, title: editingTitle.trim() } : st
      );
      setSubtasks(updatedSubtasks);
      setEditingId(null);
      setEditingTitle('');
      onSubtasksChange?.(updatedSubtasks);
      toast.success(t('subtaskUpdated', language));
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast.error('Error updating subtask');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDeleteSubtask = async (id: string) => {
    try {
      await TRService.deleteSubtask(id);
      const updatedSubtasks = subtasks.filter(st => st.id !== id);
      setSubtasks(updatedSubtasks);
      onSubtasksChange?.(updatedSubtasks);
      toast.success(t('subtaskDeleted', language));
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast.error('Error deleting subtask');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{t('subtasks', language)}</h4>
        <span className="text-xs text-muted-foreground">
          {subtasks.filter(st => st.completed).length}/{subtasks.length}
        </span>
      </div>

      {/* Existing Subtasks */}
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="flex items-center gap-2 p-2 bg-secondary/20 rounded-md">
            <Checkbox
              checked={subtask.completed}
              onCheckedChange={(checked) => handleToggleSubtask(subtask.id, !!checked)}
              className="shrink-0"
            />
            
            {editingId === subtask.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="flex-1 h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                />
                <Button size="sm" variant="outline" onClick={handleSaveEdit} className="h-8 w-8 p-0">
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-8 w-8 p-0">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <>
                <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                  {subtask.title}
                </span>
                {!isShared && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditSubtask(subtask)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="h-3 w-3" />
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
      </div>

      {/* Add New Subtask */}
      {!isShared && (
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('enterSubtaskTitle', language)}
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
            className="flex-1"
          />
          <Button 
            size="sm" 
            onClick={handleAddSubtask} 
            disabled={!newSubtaskTitle.trim() || loading}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
