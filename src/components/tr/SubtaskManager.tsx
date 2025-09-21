
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Trash2, Edit3, Calendar as CalendarIcon, Clock, ThumbsUp } from 'lucide-react';
import { format, isAfter, parseISO, differenceInHours } from 'date-fns';
import { TRService, TRSubtask } from '@/services/trService';
import { TRSharedService } from '@/services/trSharedService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import type { TRSharedResponse } from '@/services/trSharedService';

interface SubtaskManagerProps {
  taskId: string;
  onSubtasksChange?: () => void;
  readOnly?: boolean;
  layout?: 'list' | 'grid';
  overrideAllCompleted?: boolean;
  overrideNonce?: number;
}

export const SubtaskManager: React.FC<SubtaskManagerProps> = ({ 
  taskId, 
  onSubtasksChange,
  readOnly = false,
  layout = 'list',
  overrideAllCompleted,
  overrideNonce,
}) => {
  const { language } = useTheme();
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [openDueFor, setOpenDueFor] = useState<string | null>(null);

  useEffect(() => {
    loadSubtasks();
  }, [taskId]);

  // Realtime: listen for subtask changes for this task and reload
  useEffect(() => {
    const channel = supabase
      .channel(`rt-subtasks-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_subtasks', filter: `task_id=eq.${taskId}` }, () => {
        // Small debounce to avoid double loads if many events arrive
        setTimeout(() => loadSubtasks(), 150);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  // Realtime bridge: if an assignee completes a subtask (shared response), reflect it by marking the subtask completed
  useEffect(() => {
    const channel = supabase
      .channel(`rt-shared-responses-${taskId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tr_shared_responses', filter: `task_id=eq.${taskId}` }, async (payload: any) => {
        const r = payload?.new as TRSharedResponse | undefined;
        if (r && r.response_type === 'completion' && r.is_completed && r.subtask_id) {
          try {
            await TRService.updateSubtask(r.subtask_id, { completed: true });
            await loadSubtasks();
          } catch (e) {
            console.warn('Failed to mirror assignee completion to owner subtask state', e);
          }
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [taskId]);

  // Apply optimistic override when requested
  useEffect(() => {
    if (typeof overrideAllCompleted === 'boolean') {
      setSubtasks((prev) => prev.map((s) => ({ ...s, completed: overrideAllCompleted })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideNonce]);

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
      if (completed) {
        // Record owner-side completion as a shared response so ActivityMonitor and Shared view reflect it immediately
        try {
          await TRSharedService.markSubtaskCompleted(taskId, id, 'Owner (You)', true);
        } catch (e) {
          console.warn('Non-fatal: failed to record owner completion response', e);
        }
      } else {
        // Owner unchecks: clear ALL completion responses for this subtask so assignee checkboxes uncheck in real time
        try {
          await TRSharedService.clearAllSubtaskCompletions(taskId, id);
        } catch (e) {
          console.warn('Non-fatal: failed to clear subtask completion responses', e);
        }
      }
      await loadSubtasks();
      onSubtasksChange?.();
      toast.success('Subtask updated');
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

  const isSubtaskOverdue = (s: TRSubtask) => {
    try {
      if (!s.due_date) return false;
      const dueDateTime = s.due_time ? parseISO(`${s.due_date}T${s.due_time}`) : parseISO(`${s.due_date}T23:59:59`);
      return isAfter(new Date(), dueDateTime) && !s.completed;
    } catch { return false; }
  };

  const getDueStatus = (s: TRSubtask): 'overdue' | 'soon' | 'ok' | 'none' => {
    if (!s.due_date) return 'none';
    try {
      const now = new Date();
      const due = s.due_time ? parseISO(`${s.due_date}T${s.due_time}`) : parseISO(`${s.due_date}T23:59:59`);
      if (!s.completed && isAfter(now, due)) return 'overdue';
      const hours = differenceInHours(due, now);
      if (hours <= 24 && hours >= 0) return 'soon';
      return 'ok';
    } catch {
      return 'none';
    }
  };

  const renderItem = (subtask: TRSubtask) => (
    <div key={subtask.id} className={`relative flex items-center gap-2 ${layout === 'grid' ? 'p-2 border bg-secondary/10' : 'p-2 bg-secondary/20'} rounded-md`}>
      {subtask.completed && (
        <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-px bg-emerald-500/40" />
      )}
      {subtask.completed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="w-[80%] h-[80%] rounded-xl bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-sm shadow-[0_0_2rem_rgba(16,185,129,0.15)] flex items-center justify-center">
            <span className="inline-flex items-center gap-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
              <ThumbsUp className="w-4 h-4" />
              {language === 'ar' ? 'مكتملة' : 'Completed'}
            </span>
          </div>
        </div>
      )}
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
          <Button size="sm" onClick={handleSaveEdit} className="h-8 px-2">Save</Button>
          <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-2">Cancel</Button>
        </div>
      ) : (
        <>
          <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
            {subtask.title}
          </span>
          {/* Due pill */}
          {subtask.due_date && (
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap
                ${(() => {
                  const st = getDueStatus(subtask);
                  if (st === 'overdue') return 'text-destructive border-destructive/50 ring-1 ring-destructive/40 shadow-[0_0_0.5rem_rgba(220,38,38,0.25)]';
                  if (st === 'soon') return 'text-amber-600 border-amber-500/60 ring-1 ring-amber-400/40 shadow-[0_0_0.5rem_rgba(245,158,11,0.2)]';
                  if (st === 'ok') return 'text-emerald-700 border-emerald-500/60 ring-1 ring-emerald-400/40 shadow-[0_0_0.5rem_rgba(16,185,129,0.18)]';
                  return 'text-muted-foreground border-muted-foreground/30';
                })()}`}
            >
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(subtask.due_date), 'MMM d')}{subtask.due_time ? ` ${subtask.due_time}` : ''}
              </span>
            </span>
          )}
          {false && subtask.completed && (
            <span />
          )}
          {!readOnly && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => handleStartEdit(subtask)} className="h-6 w-6 p-0">
                <Edit3 className="h-3 w-3" />
              </Button>
              {/* Due editor trigger */}
              <Popover open={openDueFor === subtask.id} onOpenChange={(open) => setOpenDueFor(open ? subtask.id : null)}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                    <CalendarIcon className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="end">
                  <div className="space-y-2">
                    <div className="text-[11px] text-muted-foreground">{language === 'ar' ? 'تاريخ ووقت المهمة الفرعية' : 'Subtask due date & time'}</div>
                    <Calendar
                      mode="single"
                      selected={subtask.due_date ? new Date(subtask.due_date) : undefined}
                      onSelect={async (date) => {
                        try {
                          await TRService.updateSubtask(subtask.id, { due_date: date ? format(date, 'yyyy-MM-dd') : null });
                          onSubtasksChange?.();
                          setOpenDueFor(null);
                        } catch (e) { console.error(e); toast.error('Failed to set date'); }
                      }}
                      initialFocus
                      className="w-full"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        value={subtask.due_time || ''}
                        placeholder="HH:mm"
                        type="time"
                        className="h-8 text-[12px]"
                        onChange={async (e) => {
                          try {
                            await TRService.updateSubtask(subtask.id, { due_time: e.target.value || null });
                            onSubtasksChange?.();
                          } catch (er) { console.error(er); toast.error('Failed to set time'); }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px]"
                        onClick={async () => {
                          try {
                            await TRService.updateSubtask(subtask.id, { due_date: null, due_time: null });
                            onSubtasksChange?.();
                            setOpenDueFor(null);
                          } catch (er) { console.error(er); toast.error('Failed to clear'); }
                        }}
                      >
                        {language === 'ar' ? 'مسح' : 'Clear'}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              <Button size="sm" variant="ghost" onClick={() => handleDeleteSubtask(subtask.id)} className="h-6 w-6 p-0 text-destructive hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{t('subtasks', language)} ({subtasks.length})</div>

      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {subtasks.map((s) => renderItem(s))}
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map((s) => renderItem(s))}
        </div>
      )}

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
}
