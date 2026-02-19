// @ts-nocheck
import React, { useState } from 'react';
import { Users, ChevronDown, ChevronUp, MessageCircle, CheckCircle2, Clock, AlertTriangle, Zap } from 'lucide-react';
import { UserStats } from './useActivityData';
import { formatDistanceToNow } from 'date-fns';
import { useTheme } from '@/providers/ThemeProvider';

interface ActivityUserTableProps {
  userStats: UserStats[];
}

export const ActivityUserTable: React.FC<ActivityUserTableProps> = ({ userStats }) => {
  const { language } = useTheme();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'performance' | 'completedSubtasks' | 'comments' | 'pendingRequests'>('performance');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  if (userStats.length === 0) return null;

  const sorted = [...userStats].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortDir === 'desc' ? -diff : diff;
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ k }: { k: typeof sortKey }) => {
    if (sortKey !== k) return <span className="opacity-20">↕</span>;
    return sortDir === 'desc' ? <ChevronDown className="h-3 w-3 inline" /> : <ChevronUp className="h-3 w-3 inline" />;
  };

  const cols = [
    { key: null, label: language === 'ar' ? 'المستخدم' : 'User', align: 'left' },
    { key: 'completedSubtasks', label: language === 'ar' ? 'مهام فرعية' : 'Subtasks', align: 'center' },
    { key: 'comments', label: language === 'ar' ? 'تعليقات' : 'Comments', align: 'center' },
    { key: 'pendingRequests', label: language === 'ar' ? 'معلقة' : 'Pending', align: 'center' },
    { key: 'performance', label: language === 'ar' ? 'الأداء' : 'Score', align: 'center' },
  ] as const;

  return (
    <div className="rounded-2xl overflow-hidden
      bg-white dark:bg-white/[0.03]
      border border-slate-200/80 dark:border-white/[0.07]
      shadow-[0_2px_16px_hsla(0,0%,0%,0.06)] dark:shadow-[0_2px_16px_hsla(0,0%,0%,0.4)]">

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-2">
        <Users className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
        <p className="text-[13px] font-bold text-foreground">
          {language === 'ar' ? 'تفاصيل المستخدمين' : 'User Breakdown'}
        </p>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground/50 bg-slate-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-lg">
          {userStats.length} {language === 'ar' ? 'مستخدم' : 'users'}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_64px_64px_64px_72px] gap-1 px-4 py-2
        bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.04]">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
          {language === 'ar' ? 'المستخدم' : 'User'}
        </p>
        {(['completedSubtasks', 'comments', 'pendingRequests', 'performance'] as const).map((k, i) => (
          <button key={k} onClick={() => handleSort(k)}
            className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider text-center hover:text-foreground transition-colors flex items-center justify-center gap-0.5">
            {cols[i + 1].label} <SortIcon k={k} />
          </button>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((u, idx) => {
        const isExpanded = expandedUser === u.name;
        const perfColor = u.performance >= 80
          ? 'text-emerald-500 dark:text-emerald-400'
          : u.performance >= 50
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-red-500 dark:text-red-400';
        const perfBg = u.performance >= 80
          ? 'bg-emerald-500'
          : u.performance >= 50
            ? 'bg-amber-500'
            : 'bg-red-500';

        return (
          <div key={u.name} className="border-b border-slate-100/80 dark:border-white/[0.04] last:border-0">
            {/* Main row */}
            <button
              onClick={() => setExpandedUser(isExpanded ? null : u.name)}
              className="w-full grid grid-cols-[1fr_64px_64px_64px_72px] gap-1 px-4 py-3
                hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors text-left touch-manipulation"
            >
              {/* Avatar + name */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-black text-white flex-shrink-0 shadow-sm"
                  style={{ background: u.color }}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-foreground truncate">{u.name}</p>
                  <p className="text-[10px] text-muted-foreground/50 truncate">
                    {u.lastActive
                      ? formatDistanceToNow(new Date(u.lastActive), { addSuffix: true })
                      : language === 'ar' ? 'لم يكن نشطاً' : 'Never active'}
                  </p>
                </div>
                <div className={`ml-1 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center
                  bg-slate-100 dark:bg-white/[0.06] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/60" />
                </div>
              </div>

              {/* Subtasks */}
              <div className="flex flex-col items-center justify-center">
                <span className="text-[13px] font-black text-foreground">{u.completedSubtasks}</span>
                <span className="text-[9px] text-muted-foreground/50">/{u.totalSubtasks}</span>
              </div>

              {/* Comments */}
              <div className="flex items-center justify-center">
                <span className="text-[13px] font-black text-foreground">{u.comments}</span>
              </div>

              {/* Pending */}
              <div className="flex items-center justify-center">
                {u.pendingRequests > 0 ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-black px-2 py-0.5 rounded-lg
                    bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {u.pendingRequests}
                  </span>
                ) : (
                  <span className="text-[13px] font-black text-muted-foreground/30">—</span>
                )}
              </div>

              {/* Score */}
              <div className="flex flex-col items-center justify-center gap-1">
                <span className={`text-[13px] font-black ${perfColor}`}>{u.performance}%</span>
                <div className="w-10 h-1 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
                  <div className={`h-full rounded-full ${perfBg} transition-all duration-500`}
                    style={{ width: `${u.performance}%` }} />
                </div>
              </div>
            </button>

            {/* Expanded detail row */}
            {isExpanded && (
              <div className="px-4 pb-4 pt-1 bg-slate-50/50 dark:bg-white/[0.01] border-t border-slate-100 dark:border-white/[0.04]">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {[
                    { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: language === 'ar' ? 'مهام مكتملة' : 'Tasks done', value: u.completedTasks, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
                    { icon: <Zap className="h-3.5 w-3.5" />, label: language === 'ar' ? 'مهام فرعية' : 'Subtasks done', value: `${u.completedSubtasks}/${u.totalSubtasks}`, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
                    { icon: <MessageCircle className="h-3.5 w-3.5" />, label: language === 'ar' ? 'تعليقات' : 'Comments', value: u.comments, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                    { icon: <Clock className="h-3.5 w-3.5" />, label: language === 'ar' ? 'طلبات معلقة' : 'Pending reqs', value: u.pendingRequests, color: u.pendingRequests > 0 ? 'text-orange-500' : 'text-muted-foreground/40', bg: u.pendingRequests > 0 ? 'bg-orange-50 dark:bg-orange-500/10' : 'bg-slate-50 dark:bg-white/[0.03]' },
                  ].map((stat, i) => (
                    <div key={i} className={`rounded-xl p-3 ${stat.bg} flex items-center gap-2`}>
                      <div className={`${stat.color} flex-shrink-0`}>{stat.icon}</div>
                      <div>
                        <p className={`text-[14px] font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground/60">{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mini performance bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground/60">
                      {language === 'ar' ? 'نسبة الأداء' : 'Performance score'}
                    </span>
                    <span className={`text-[11px] font-black ${perfColor}`}>{u.performance}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-white/[0.08] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${perfBg} transition-all duration-700`}
                      style={{ width: `${u.performance}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
