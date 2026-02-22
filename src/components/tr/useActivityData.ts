// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { subWeeks, subMonths, isAfter, parseISO, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns';
import { TRTask, TRSubtask, TRService } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

export interface UserStats {
  name: string;
  completedTasks: number;
  completedSubtasks: number;
  totalSubtasks: number;
  comments: number;
  pendingRequests: number;
  performance: number;
  lastActive: string | null;
  color: string;
}

export const ACCENT_COLORS = [
  'hsl(210,100%,65%)', 'hsl(142,76%,55%)', 'hsl(280,70%,65%)',
  'hsl(25,95%,60%)', 'hsl(180,85%,60%)', 'hsl(320,75%,70%)', 'hsl(45,100%,60%)',
];

export function getRangeStart(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case '1W': return subWeeks(now, 1);
    case '1M': return subMonths(now, 1);
    case '3M': return subMonths(now, 3);
    case '6M': return subMonths(now, 6);
    case '1Y': return subMonths(now, 12);
  }
}

export function getIntervalLabel(date: Date, range: TimeRange): string {
  return (range === '1W' || range === '1M') ? format(date, 'MMM d') : format(date, 'MMM yy');
}

export function useActivityData(tasks: TRTask[]) {
  const [responses, setResponses] = useState<{ [taskId: string]: TRSharedResponse[] }>({});
  const [subtasks, setSubtasks] = useState<{ [taskId: string]: TRSubtask[] }>({});
  const [assignedTasks, setAssignedTasks] = useState<TRTask[]>([]);
  const [assignedSubtasks, setAssignedSubtasks] = useState<{ [taskId: string]: TRSubtask[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sharedTasks = useMemo(() => tasks.filter(t => t.is_shared && t.share_link), [tasks]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // 1. Fetch shared task responses + subtasks
      const allR: { [id: string]: TRSharedResponse[] } = {};
      const allS: { [id: string]: TRSubtask[] } = {};
      if (sharedTasks.length > 0) {
        await Promise.all(sharedTasks.map(async (task) => {
          const [r, s] = await Promise.all([
            TRSharedService.getTaskResponses(task.id),
            TRSharedService.getTaskSubtasks(task.id),
          ]);
          allR[task.id] = r;
          allS[task.id] = s;
        }));
      }

      // 2. Fetch subtasks for ALL personal tasks (including non-shared)
      const personalTasks = tasks.filter(t => !allS[t.id]); // tasks not already fetched
      if (personalTasks.length > 0) {
        await Promise.all(personalTasks.map(async (task) => {
          const s = await TRService.getSubtasks(task.id);
          allS[task.id] = s;
        }));
      }

      // 3. Fetch assigned-to-me tasks + their subtasks
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: assignmentData } = await supabase
          .from('tr_task_assignments')
          .select('id,task_id,status,task:tr_tasks(id,title,completed,due_date,due_time,priority,is_shared,share_link,created_at,updated_at,user_id)')
          .eq('assignee_id', user.id)
          .eq('status', 'approved');

        const assignedTasksList: TRTask[] = [];
        const assignedSubs: { [taskId: string]: TRSubtask[] } = {};

        if (assignmentData && assignmentData.length > 0) {
          for (const a of assignmentData) {
            const t = a.task;
            if (t && !tasks.some(own => own.id === t.id)) {
              // Only include tasks not already in user's own tasks list
              assignedTasksList.push(t as TRTask);
              // Fetch subtasks for assigned tasks
              try {
                const { data: subs } = await supabase
                  .from('tr_subtasks')
                  .select('*')
                  .eq('task_id', t.id)
                  .order('order_index', { ascending: true });
                assignedSubs[t.id] = subs || [];
                allS[t.id] = subs || [];
              } catch { assignedSubs[t.id] = []; }
            }
          }
        }
        setAssignedTasks(assignedTasksList);
        setAssignedSubtasks(assignedSubs);
      }

      setResponses(allR);
      setSubtasks(allS);
    } catch {
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sharedTasks, tasks]);

  useEffect(() => { loadData(); }, [loadData]);

  // All tasks combined: personal (own) + assigned-to-me (deduped)
  const allTasks = useMemo(() => {
    const ownIds = new Set(tasks.map(t => t.id));
    const extra = assignedTasks.filter(t => !ownIds.has(t.id));
    return [...tasks, ...extra];
  }, [tasks, assignedTasks]);

  const allSubtasks = useMemo(() => Object.values(subtasks).flat(), [subtasks]);

  const kpis = useMemo(() => {
    const now = new Date();
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    // late = not completed AND has a due_date that has passed
    const late = allTasks.filter(t =>
      !t.completed && t.due_date &&
      isAfter(now, new Date(`${t.due_date}T${t.due_time || '23:59:59'}`))
    ).length;
    // pending = not completed AND not late
    const pending = allTasks.filter(t =>
      !t.completed && !(t.due_date && isAfter(now, new Date(`${t.due_date}T${t.due_time || '23:59:59'}`)))
    ).length;
    const totalSub = allSubtasks.length;
    const completedSub = allSubtasks.filter(s => s.completed).length;
    // Performance = completed / total, capped at 100
    const performance = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    return { total, completed, pending, late, totalSub, completedSub, performance };
  }, [allTasks, allSubtasks]);

  const userStats = useMemo((): UserStats[] => {
    // Normalize name: trim + collapse spaces, used as dedup key
    const normalizeName = (n: string) => n.trim().replace(/\s+/g, ' ');
    // Map keyed by normalized name, but display name is the first seen
    const map: { [normName: string]: Omit<UserStats, 'color'> & { _normName: string } } = {};
    const allResp = Object.values(responses).flat();

    allResp.forEach(r => {
      const raw = r.visitor_name || 'Unknown';
      const norm = normalizeName(raw).toLowerCase();
      if (!map[norm]) map[norm] = { name: normalizeName(raw), _normName: norm, completedTasks: 0, completedSubtasks: 0, totalSubtasks: 0, comments: 0, pendingRequests: 0, performance: 0, lastActive: null };
      const u = map[norm];
      if (r.response_type === 'completion' && r.is_completed && !r.subtask_id) u.completedTasks++;
      if (r.response_type === 'completion' && r.is_completed && r.subtask_id) u.completedSubtasks++;
      if (r.response_type === 'comment') u.comments++;
      if ((r.response_type === 'snooze_request' || r.response_type === 'completion_request') && !r.content?.includes('"status"')) u.pendingRequests++;
      if (!u.lastActive || r.created_at > u.lastActive) u.lastActive = r.created_at;
    });

    Object.values(map).forEach(u => {
      // Count unique subtasks this user touched (by subtask_id)
      const touchedIds = new Set(
        allResp
          .filter(r => normalizeName(r.visitor_name || '').toLowerCase() === u._normName && r.subtask_id)
          .map(r => r.subtask_id)
      );
      u.totalSubtasks = touchedIds.size;
      // completedSubtasks = unique subtask_ids where the latest response is a completion
      const completedIds = new Set(
        allResp
          .filter(r => normalizeName(r.visitor_name || '').toLowerCase() === u._normName && r.subtask_id && r.response_type === 'completion' && r.is_completed)
          .map(r => r.subtask_id)
      );
      u.completedSubtasks = completedIds.size;
      // Performance capped at 100
      u.performance = u.totalSubtasks > 0
        ? Math.min(100, Math.round((u.completedSubtasks / u.totalSubtasks) * 100))
        : (u.completedTasks > 0 ? 100 : 0);
    });

    return Object.values(map)
      .map(({ _normName, ...rest }) => rest)
      .sort((a, b) => b.performance - a.performance)
      .map((u, i) => ({ ...u, color: ACCENT_COLORS[i % ACCENT_COLORS.length] }));
  }, [responses]);

  function getTrendData(range: TimeRange) {
    const rangeStart = getRangeStart(range);
    const now = new Date();
    const allResp = Object.values(responses).flat().filter(r => isAfter(parseISO(r.created_at), rangeStart));

    // Also include personal task completions in the trend (tasks completed within range)
    const personalCompletions = allTasks
      .filter(t => t.completed && t.completed_at && isAfter(parseISO(t.completed_at), rangeStart))
      .map(t => ({ created_at: t.completed_at!, type: 'task_completion' as const }));

    const intervals = (range === '1W' || range === '1M')
      ? eachWeekOfInterval({ start: rangeStart, end: now })
      : eachMonthOfInterval({ start: rangeStart, end: now });
    return intervals.map((date, i) => {
      const periodEnd = i < intervals.length - 1 ? intervals[i + 1] : now;
      const inP = (created: string) => isAfter(parseISO(created), date) && !isAfter(parseISO(created), periodEnd);
      return {
        label: getIntervalLabel(date, range),
        completions: allResp.filter(r => r.response_type === 'completion' && r.is_completed && inP(r.created_at)).length
          + personalCompletions.filter(c => inP(c.created_at)).length,
        comments: allResp.filter(r => r.response_type === 'comment' && inP(r.created_at)).length,
      };
    });
  }

  return { sharedTasks, allTasks, responses, loading, refreshing, loadData, kpis, userStats, getTrendData };
}
