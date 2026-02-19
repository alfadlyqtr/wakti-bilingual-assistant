
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Trash2, Edit3, Calendar as CalendarIcon, Clock, Check, X, Save } from 'lucide-react';
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
  refreshTrigger?: number;
}

export const SubtaskManager: React.FC<SubtaskManagerProps> = ({ 
  taskId, 
  onSubtasksChange,
  readOnly = false,
  layout = 'list',
  overrideAllCompleted,
  overrideNonce,
  refreshTrigger,
}) => {
  const { language } = useTheme();
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [openDueFor, setOpenDueFor] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadSubtasks(true);
    return () => { isMountedRef.current = false; };
  }, [taskId]);

  // Reload when parent bumps refreshTrigger (e.g. Mark All Done)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0) {
      loadSubtasks();
    }
  }, [refreshTrigger]);

  // Realtime: listen for subtask changes for this task and reload
  useEffect(() => {
    const channel = supabase
      .channel(`rt-subtasks-${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tr_subtasks', filter: `task_id=eq.${taskId}` }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { if (isMountedRef.current) loadSubtasks(); }, 400);
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

  const loadSubtasks = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const data = await TRService.getSubtasks(taskId);
      if (isMountedRef.current) setSubtasks(data);
    } catch (error) {
      console.error('Error loading subtasks:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
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

  const handleToggleSubtask = useCallback(async (id: string, completed: boolean) => {
    // Optimistic update — instant UI feedback, no reload needed
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, completed } : s));
    try {
      await TRService.updateSubtask(id, { completed });
      if (completed) {
        TRSharedService.markSubtaskCompleted(taskId, id, 'Owner (You)', true).catch(() => {});
      } else {
        TRSharedService.clearAllSubtaskCompletions(taskId, id).catch(() => {});
      }
    } catch (error) {
      // Revert optimistic update on failure
      setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, completed: !completed } : s));
      console.error('Error updating subtask:', error);
      toast.error('Failed to update subtask');
    }
  }, [taskId]);

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

  if (loading && subtasks.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60 animate-spin" />
        {language === 'ar' ? 'جارٍ التحميل...' : 'Loading...'}
      </div>
    );
  }

  if (subtasks.length === 0 && readOnly) {
    return <div className="text-xs text-muted-foreground py-2">{language === 'ar' ? 'لا توجد مهام فرعية' : 'No subtasks'}</div>;
  }

  const getDueStatus = (s: TRSubtask): 'overdue' | 'soon' | 'ok' | 'none' => {
    if (!s.due_date) return 'none';
    try {
      const now = new Date();
      const due = s.due_time ? parseISO(`${s.due_date}T${s.due_time}`) : parseISO(`${s.due_date}T23:59:59`);
      if (!s.completed && isAfter(now, due)) return 'overdue';
      const hours = differenceInHours(due, now);
      if (hours <= 24 && hours >= 0) return 'soon';
      return 'ok';
    } catch { return 'none'; }
  };

  const renderItem = (subtask: TRSubtask) => {
    const done = subtask.completed;
    const dueStatus = getDueStatus(subtask);

    return (
      <div
        key={subtask.id}
        className={`group/item flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-all duration-150
          ${done
            ? 'bg-emerald-50/60 dark:bg-emerald-950/20'
            : 'bg-muted/40 hover:bg-muted/70 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]'
          }`}
      >
        {/* Checkbox */}
        <button
          onClick={() => !readOnly && handleToggleSubtask(subtask.id, !done)}
          disabled={readOnly}
          className={`flex-shrink-0 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all duration-150 touch-manipulation active:scale-90
            ${done
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-muted-foreground/30 hover:border-[#060541] dark:hover:border-indigo-400'
            }`}
        >
          {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
        </button>

        {editingId === subtask.id ? (
          <div className="flex-1 flex items-center gap-1.5">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1 h-7 rounded-lg text-xs px-2"
              autoFocus
            />
            <button title="Save" onClick={handleSaveEdit} className="h-7 w-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors touch-manipulation">
              <Save className="w-3 h-3" />
            </button>
            <button title="Cancel" onClick={handleCancelEdit} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors touch-manipulation">
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <>
            <span className={`flex-1 text-sm leading-snug min-w-0 ${
              done ? 'line-through text-muted-foreground/40' : 'text-foreground'
            }`}>
              {subtask.title}
            </span>

            {/* Due pill */}
            {subtask.due_date && (
              <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap
                ${dueStatus === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  dueStatus === 'soon' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-muted text-muted-foreground'}`}>
                <Clock className="w-2.5 h-2.5" />
                {format(new Date(subtask.due_date), 'MMM d')}
              </span>
            )}

            {/* Actions — fade in on hover */}
            {!readOnly && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity flex-shrink-0">
                <button title="Edit" onClick={() => handleStartEdit(subtask)}
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-background dark:hover:bg-white/10 transition-colors touch-manipulation">
                  <Edit3 className="h-3 h-3 text-muted-foreground" />
                </button>
                <Popover open={openDueFor === subtask.id} onOpenChange={(open) => setOpenDueFor(open ? subtask.id : null)}>
                  <PopoverTrigger asChild>
                    <button title="Set due date"
                      className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-background dark:hover:bg-white/10 transition-colors touch-manipulation">
                      <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 rounded-xl" align="end">
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        {language === 'ar' ? 'تاريخ ووقت المهمة الفرعية' : 'Subtask due date & time'}
                      </p>
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
                          className="h-8 text-xs rounded-lg"
                          onChange={async (e) => {
                            try {
                              await TRService.updateSubtask(subtask.id, { due_time: e.target.value || null });
                              onSubtasksChange?.();
                            } catch (er) { console.error(er); toast.error('Failed to set time'); }
                          }}
                        />
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg"
                          onClick={async () => {
                            try {
                              await TRService.updateSubtask(subtask.id, { due_date: null, due_time: null });
                              onSubtasksChange?.();
                              setOpenDueFor(null);
                            } catch (er) { console.error(er); toast.error('Failed to clear'); }
                          }}>
                          {language === 'ar' ? 'مسح' : 'Clear'}
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <button title="Delete" onClick={() => handleDeleteSubtask(subtask.id)}
                  className="h-6 w-6 rounded-md flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors touch-manipulation">
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className="space-y-2.5">
      {/* Progress bar + count */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-2.5">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
            {completedCount}/{subtasks.length}
          </span>
        </div>
      )}

      {/* Subtask items */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5">
          {subtasks.map((s) => renderItem(s))}
        </div>
      ) : (
        <div className="space-y-1">
          {subtasks.map((s) => renderItem(s))}
        </div>
      )}

      {/* Add input */}
      {!readOnly && (
        <div className="flex items-center gap-2 mt-1">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
            }}
            placeholder={language === 'ar' ? 'أضف مهمة فرعية...' : 'Add a subtask...'}
            className="flex-1 h-9 rounded-xl text-sm border-dashed focus:border-solid focus:border-[#060541] dark:focus:border-indigo-400 bg-transparent placeholder:text-muted-foreground/40"
          />
          <button
            type="button"
            onClick={handleAddSubtask}
            title="Add subtask"
            className="h-9 w-9 rounded-xl flex items-center justify-center bg-[#060541] dark:bg-indigo-500 text-white hover:opacity-90 active:scale-95 transition-all touch-manipulation flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
