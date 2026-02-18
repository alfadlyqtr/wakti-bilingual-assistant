
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

  const renderItem = (subtask: TRSubtask) => {
    const done = subtask.completed;
    const dueStatus = getDueStatus(subtask);

    return (
      <div
        key={subtask.id}
        className={`group/item relative flex items-center gap-3 rounded-xl border transition-all duration-200
          ${layout === 'grid' ? 'p-3' : 'p-3'}
          ${done
            ? 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200/40 dark:border-emerald-800/30'
            : 'bg-white/60 dark:bg-white/[0.03] border-slate-200/60 dark:border-slate-700/40 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
      >
        {/* Custom checkbox */}
        <button
          onClick={() => !readOnly && handleToggleSubtask(subtask.id, !done)}
          disabled={readOnly}
          className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 touch-manipulation
            ${done
              ? 'bg-emerald-500 border-emerald-500 text-white scale-100'
              : 'border-slate-300 dark:border-slate-600 hover:border-[#060541] dark:hover:border-indigo-400 active:scale-90'
            }`}
        >
          {done && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        {editingId === subtask.id ? (
          <div className="flex-1 flex items-center gap-2">
            <Input
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              className="flex-1 h-8 rounded-lg text-sm"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveEdit} className="h-8 px-2.5 rounded-lg gap-1 bg-emerald-500 hover:bg-emerald-600 text-white">
              <Save className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-2.5 rounded-lg">
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className={`flex-1 text-sm leading-snug transition-all duration-200 ${
              done ? 'line-through text-muted-foreground/50' : 'text-foreground'
            }`}>
              {subtask.title}
            </span>

            {/* Due pill */}
            {subtask.due_date && (
              <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap ${
                dueStatus === 'overdue' ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' :
                dueStatus === 'soon' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' :
                dueStatus === 'ok' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400' :
                'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {format(new Date(subtask.due_date), 'MMM d')}{subtask.due_time ? ` ${subtask.due_time}` : ''}
                </span>
              </span>
            )}

            {/* Action buttons - visible on hover/touch */}
            {!readOnly && (
              <div className="flex items-center gap-0.5 opacity-40 group-hover/item:opacity-100 transition-opacity">
                <button title="Edit" onClick={() => handleStartEdit(subtask)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                  <Edit3 className="h-3 w-3 text-slate-500" />
                </button>
                <Popover open={openDueFor === subtask.id} onOpenChange={(open) => setOpenDueFor(open ? subtask.id : null)}>
                  <PopoverTrigger asChild>
                    <button title="Due date" className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors touch-manipulation">
                      <CalendarIcon className="h-3 w-3 text-slate-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 rounded-xl" align="end">
                    <div className="space-y-2">
                      <div className="text-[11px] font-medium text-muted-foreground">{language === 'ar' ? 'تاريخ ووقت المهمة الفرعية' : 'Subtask due date & time'}</div>
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
                          className="h-8 text-[12px] rounded-lg"
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
                          className="h-8 text-[12px] rounded-lg"
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
                <button title="Delete" onClick={() => handleDeleteSubtask(subtask.id)} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors touch-manipulation">
                  <Trash2 className="h-3 w-3 text-red-400 dark:text-red-500" />
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
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-emerald-400 to-teal-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground/70 tabular-nums">
          {completedCount}/{subtasks.length}
        </span>
      </div>

      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {subtasks.map((s) => renderItem(s))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {subtasks.map((s) => renderItem(s))}
        </div>
      )}

      {!readOnly && (
        <div className="relative mt-2">
          <Input
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubtask();
              }
            }}
            placeholder={language === 'ar' ? 'أضف مهمة فرعية...' : 'Add a subtask...'}
            className="pr-10 h-10 rounded-xl border-dashed border-slate-300 dark:border-slate-700 bg-transparent placeholder:text-muted-foreground/40 focus:border-solid focus:border-[#060541] dark:focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={handleAddSubtask}
            title="Add subtask"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg flex items-center justify-center bg-[#060541] dark:bg-indigo-500 text-white hover:opacity-90 transition-opacity touch-manipulation active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
