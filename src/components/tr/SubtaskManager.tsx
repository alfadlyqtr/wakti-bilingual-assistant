
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
  const [ownerName, setOwnerName] = useState<string>('Owner');
  const [subtasks, setSubtasks] = useState<TRSubtask[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from('profiles').select('display_name, first_name, last_name').eq('id', user.id).single();
      const full = [data?.first_name, data?.last_name].filter(Boolean).join(' ');
      setOwnerName(data?.display_name || full || user.email?.split('@')[0] || 'Owner');
    });
  }, []);
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
        TRSharedService.markSubtaskCompleted(taskId, id, ownerName, true).catch(() => {});
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
      <div className="flex items-center gap-2.5 py-4 text-xs text-muted-foreground">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
        </div>
        {language === 'ar' ? 'جارٍ التحميل...' : 'Loading subtasks...'}
      </div>
    );
  }

  if (subtasks.length === 0 && readOnly) {
    return <div className="text-xs text-muted-foreground/60 py-2 italic">{language === 'ar' ? 'لا توجد مهام فرعية' : 'No subtasks'}</div>;
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

  const renderItem = (subtask: TRSubtask, itemLayout: 'list' | 'grid') => {
    const done = subtask.completed;
    const dueStatus = getDueStatus(subtask);
    const isGrid = itemLayout === 'grid';

    const cardBase = `group/item relative rounded-2xl transition-all duration-200
      ${done
        ? 'bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-950/30 dark:to-emerald-950/15'
        : 'bg-white dark:bg-white/[0.06] hover:bg-slate-50/80 dark:hover:bg-white/[0.09]'
      }
      border
      ${done
        ? 'border-emerald-200/60 dark:border-emerald-700/30'
        : 'border-slate-200/80 dark:border-white/[0.08]'
      }
      shadow-[0_2px_12px_hsla(0,0%,0%,0.08),0_1px_3px_hsla(0,0%,0%,0.06)]
      dark:shadow-[0_2px_12px_hsla(0,0%,0%,0.35),0_1px_4px_hsla(0,0%,0%,0.25)]`;

    const checkbox = (
      <button
        onClick={() => !readOnly && handleToggleSubtask(subtask.id, !done)}
        disabled={readOnly}
        className={`flex-shrink-0 w-[20px] h-[20px] rounded-lg flex items-center justify-center transition-all duration-200 touch-manipulation active:scale-90
          ${done
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_2px_6px_hsla(142,76%,45%,0.3)]'
            : 'border-2 border-slate-300/70 dark:border-white/15 hover:border-[#060541] dark:hover:border-indigo-400'
          }`}
      >
        {done && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </button>
    );

    const actionButtons = !readOnly ? (
      <div className="flex items-center gap-1">
        <button title="Edit" onClick={() => handleStartEdit(subtask)}
          className="h-7 w-7 rounded-lg flex items-center justify-center
            bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30
            text-blue-600 dark:text-blue-400
            transition-colors touch-manipulation active:scale-90">
          <Edit3 className="h-3.5 w-3.5" />
        </button>
        <Popover open={openDueFor === subtask.id} onOpenChange={(open) => setOpenDueFor(open ? subtask.id : null)}>
          <PopoverTrigger asChild>
            <button title="Set due date"
              className="h-7 w-7 rounded-lg flex items-center justify-center
                bg-amber-100 dark:bg-amber-500/20 hover:bg-amber-200 dark:hover:bg-amber-500/30
                text-amber-600 dark:text-amber-400
                transition-colors touch-manipulation active:scale-90">
              <CalendarIcon className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
                  <PopoverContent className="w-72 p-3 rounded-2xl backdrop-blur-xl
                    bg-white/95 dark:bg-[#1a1d28]/95 border border-slate-200/80 dark:border-white/10
                    shadow-[0_8px_40px_hsla(0,0%,0%,0.12)] dark:shadow-[0_8px_40px_hsla(0,0%,0%,0.5)]" align="end">
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                        {language === 'ar' ? 'تاريخ ووقت المهمة الفرعية' : 'Due date & time'}
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
          className="h-7 w-7 rounded-lg flex items-center justify-center
            bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30
            text-red-600 dark:text-red-400
            transition-colors touch-manipulation active:scale-90">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    ) : null;

    if (editingId === subtask.id) {
      return (
        <div key={subtask.id} className={`${cardBase} flex items-center gap-1.5 px-3.5 py-3`}>
          {checkbox}
          <Input
            value={editingTitle}
            onChange={(e) => setEditingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveEdit();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            className="flex-1 h-8 rounded-lg text-sm px-2.5 border-[#060541]/30 dark:border-indigo-500/30 focus:border-[#060541] dark:focus:border-indigo-500"
            autoFocus
          />
          <button title="Save" onClick={handleSaveEdit}
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center hover:shadow-[0_2px_8px_hsla(142,76%,45%,0.3)] transition-all touch-manipulation">
            <Save className="w-3.5 h-3.5" />
          </button>
          <button title="Cancel" onClick={handleCancelEdit}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors touch-manipulation">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      );
    }

    /* ── GRID layout: vertical card ── */
    if (isGrid) {
      return (
        <div key={subtask.id} className={`${cardBase} flex flex-col gap-2.5 p-3`}>
          {/* Top row: checkbox + title */}
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5">{checkbox}</div>
            <span className={`flex-1 text-[13px] font-medium leading-snug ${
              done ? 'line-through text-muted-foreground/35' : 'text-foreground'
            }`}>
              {subtask.title}
            </span>
          </div>
          {/* Bottom row: due pill + action buttons */}
          <div className="flex items-center justify-between gap-2 pl-[28px]">
            {subtask.due_date ? (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap
                ${dueStatus === 'overdue'
                  ? 'bg-gradient-to-r from-red-50 to-red-100/80 text-red-600 dark:from-red-900/30 dark:to-red-900/20 dark:text-red-400'
                  : dueStatus === 'soon'
                    ? 'bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-600 dark:from-amber-900/30 dark:to-amber-900/20 dark:text-amber-400'
                    : 'bg-slate-100/80 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400'
                } shadow-[inset_0_1px_0_hsla(0,0%,100%,0.3)]`}>
                <Clock className="w-2.5 h-2.5" />
                {format(new Date(subtask.due_date), 'MMM d')}
              </span>
            ) : <span />}
            {actionButtons}
          </div>
        </div>
      );
    }

    /* ── LIST layout: horizontal row ── */
    return (
      <div key={subtask.id} className={`${cardBase} flex items-center gap-3 px-3.5 py-3`}>
        {checkbox}
        <span className={`flex-1 text-[13px] font-medium leading-snug min-w-0 ${
          done ? 'line-through text-muted-foreground/35' : 'text-foreground'
        }`}>
          {subtask.title}
        </span>
        {subtask.due_date && (
          <span className={`flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap
            ${dueStatus === 'overdue'
              ? 'bg-gradient-to-r from-red-50 to-red-100/80 text-red-600 dark:from-red-900/30 dark:to-red-900/20 dark:text-red-400'
              : dueStatus === 'soon'
                ? 'bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-600 dark:from-amber-900/30 dark:to-amber-900/20 dark:text-amber-400'
                : 'bg-slate-100/80 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400'
            } shadow-[inset_0_1px_0_hsla(0,0%,100%,0.3)]`}>
            <Clock className="w-2.5 h-2.5" />
            {format(new Date(subtask.due_date), 'MMM d')}
          </span>
        )}
        <div className="flex-shrink-0 opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity">
          {actionButtons}
        </div>
      </div>
    );
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const progress = subtasks.length > 0 ? (completedCount / subtasks.length) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* ── Gradient progress bar ── */}
      {subtasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-[5px] bg-slate-100 dark:bg-white/[0.04] rounded-full overflow-hidden shadow-[inset_0_1px_2px_hsla(0,0%,0%,0.06)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 transition-all duration-700 ease-out
                shadow-[0_0_8px_hsla(142,76%,45%,0.3)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground/60 min-w-[32px] text-right">
            {completedCount}/{subtasks.length}
          </span>
        </div>
      )}

      {/* ── Subtask items ── */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {subtasks.map((s) => renderItem(s, 'grid'))}
        </div>
      ) : (
        <div className="space-y-2">
          {subtasks.map((s) => renderItem(s, 'list'))}
        </div>
      )}

      {/* ── Add subtask input ── */}
      {!readOnly && (
        <div className="flex items-center gap-2.5 mt-2">
          <div className="flex-1 relative">
            <Input
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask(); }
              }}
              placeholder={language === 'ar' ? 'أضف مهمة فرعية...' : 'Add a subtask...'}
              className="h-10 rounded-xl text-sm pl-4 pr-4
                border-slate-200/60 dark:border-white/[0.06]
                bg-white/60 dark:bg-white/[0.02]
                focus:border-[#060541]/40 dark:focus:border-indigo-500/40
                focus:shadow-[0_0_0_3px_hsla(240,80%,50%,0.06)]
                placeholder:text-muted-foreground/30
                transition-all duration-200"
            />
          </div>
          <button
            type="button"
            onClick={handleAddSubtask}
            title="Add subtask"
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0
              bg-gradient-to-br from-[#060541] to-[#1a1080] dark:from-indigo-600 dark:to-indigo-500
              text-white shadow-[0_2px_10px_hsla(240,80%,40%,0.25)]
              hover:shadow-[0_4px_16px_hsla(240,80%,40%,0.35)]
              active:scale-95 transition-all duration-200 touch-manipulation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
