// @ts-nocheck
import { useState, useEffect, useMemo, useCallback } from 'react';
import { subWeeks, subMonths, isAfter, parseISO, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns';
import { TRTask, TRSubtask } from '@/services/trService';
import { TRSharedService, TRSharedResponse } from '@/services/trSharedService';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const sharedTasks = useMemo(() => tasks.filter(t => t.is_shared && t.share_link), [tasks]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (sharedTasks.length === 0) { setLoading(false); return; }
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const allR: { [id: string]: TRSharedResponse[] } = {};
      const allS: { [id: string]: TRSubtask[] } = {};
      await Promise.all(sharedTasks.map(async (task) => {
        const [r, s] = await Promise.all([
          TRSharedService.getTaskResponses(task.id),
          TRSharedService.getTaskSubtasks(task.id),
        ]);
        allR[task.id] = r;
        allS[task.id] = s;
      }));
      setResponses(allR);
      setSubtasks(allS);
    } catch {
      toast.error('Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sharedTasks]);

  useEffect(() => { loadData(); }, [loadData]);

  const allSubtasks = useMemo(() => Object.values(subtasks).flat(), [subtasks]);

  const kpis = useMemo(() => {
    const completed = sharedTasks.filter(t => t.completed).length;
    const pending = sharedTasks.filter(t => !t.completed).length;
    const now = new Date();
    const late = sharedTasks.filter(t => !t.completed && t.due_date && isAfter(now, parseISO(t.due_date))).length;
    const totalSub = allSubtasks.length;
    const completedSub = allSubtasks.filter(s => s.completed).length;
    const performance = sharedTasks.length > 0 ? Math.round((completed / sharedTasks.length) * 100) : 0;
    return { completed, pending, late, totalSub, completedSub, performance };
  }, [sharedTasks, allSubtasks]);

  const userStats = useMemo((): UserStats[] => {
    const map: { [name: string]: Omit<UserStats, 'color'> } = {};
    const allResp = Object.values(responses).flat();
    allResp.forEach(r => {
      const name = r.visitor_name || 'Unknown';
      if (!map[name]) map[name] = { name, completedTasks: 0, completedSubtasks: 0, totalSubtasks: 0, comments: 0, pendingRequests: 0, performance: 0, lastActive: null };
      const u = map[name];
      if (r.response_type === 'completion' && r.is_completed && !r.subtask_id) u.completedTasks++;
      if (r.response_type === 'completion' && r.is_completed && r.subtask_id) u.completedSubtasks++;
      if (r.response_type === 'comment') u.comments++;
      if ((r.response_type === 'snooze_request' || r.response_type === 'completion_request') && !r.content?.includes('"status"')) u.pendingRequests++;
      if (!u.lastActive || r.created_at > u.lastActive) u.lastActive = r.created_at;
    });
    Object.values(map).forEach(u => {
      const touched = new Set(allResp.filter(r => r.visitor_name === u.name && r.subtask_id).map(r => r.subtask_id));
      u.totalSubtasks = touched.size;
      u.performance = u.totalSubtasks > 0 ? Math.round((u.completedSubtasks / u.totalSubtasks) * 100) : (u.completedTasks > 0 ? 100 : 0);
    });
    return Object.values(map)
      .sort((a, b) => b.performance - a.performance)
      .map((u, i) => ({ ...u, color: ACCENT_COLORS[i % ACCENT_COLORS.length] }));
  }, [responses]);

  function getTrendData(range: TimeRange) {
    const rangeStart = getRangeStart(range);
    const now = new Date();
    const allResp = Object.values(responses).flat().filter(r => isAfter(parseISO(r.created_at), rangeStart));
    const intervals = (range === '1W' || range === '1M')
      ? eachWeekOfInterval({ start: rangeStart, end: now })
      : eachMonthOfInterval({ start: rangeStart, end: now });
    return intervals.map((date, i) => {
      const periodEnd = i < intervals.length - 1 ? intervals[i + 1] : now;
      const inP = (r: TRSharedResponse) => isAfter(parseISO(r.created_at), date) && !isAfter(parseISO(r.created_at), periodEnd);
      return {
        label: getIntervalLabel(date, range),
        completions: allResp.filter(r => r.response_type === 'completion' && r.is_completed && inP(r)).length,
        comments: allResp.filter(r => r.response_type === 'comment' && inP(r)).length,
      };
    });
  }

  return { sharedTasks, responses, loading, refreshing, loadData, kpis, userStats, getTrendData };
}
