
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, ListTodo } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRTask, TRReminder } from '@/services/trService';
import { TaskForm } from '@/components/tr/TaskForm';
import { ReminderForm } from '@/components/tr/ReminderForm';
import { TaskList } from '@/components/tr/TaskList';
import { ReminderList } from '@/components/tr/ReminderList';
import { ActivityMonitor } from '@/components/tr/ActivityMonitor';
import { SharedTasksTab } from '@/components/tr/SharedTasksTab';
import { ActivityDashboard } from '@/components/tr/ActivityDashboard';
import { useTRData } from '@/hooks/useTRData';
import { PageTitle } from '@/components/PageTitle';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function TasksReminders() {
  const { language } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const incomingShareLink = searchParams.get('shared') || null;
  const [activeTab, setActiveTab] = useState(
    incomingShareLink ? 'activity' : 'activity_main'
  );
  const { tasks, reminders, loading, error, refresh } = useTRData();

  // When a ?shared= param arrives, switch to Shared Tasks tab
  useEffect(() => {
    if (incomingShareLink) {
      setActiveTab('activity');
    }
  }, [incomingShareLink]);
  // Auto-delete toggle (24h after completion). Default OFF. Persist to localStorage.
  const [autoDelete24h, setAutoDelete24h] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tr:autoDelete24hEnabled');
      return saved === null ? false : saved === 'true';
    } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('tr:autoDelete24hEnabled', String(autoDelete24h)); } catch {}
  }, [autoDelete24h]);
  
  // Ensure the page starts at the title area on load
  useEffect(() => {
    try {
      const scroller = document.querySelector('main.flex-1');
      if (scroller && 'scrollTo' in scroller) {
        (scroller as HTMLElement).scrollTo({ top: 0, behavior: 'auto' });
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    } catch {}
  }, []);
  
  // Form states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TRTask | null>(null);
  const [editingReminder, setEditingReminder] = useState<TRReminder | null>(null);

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskFormOpen(true);
  };

  const handleEditTask = (task: TRTask) => {
    setEditingTask(task);
    setTaskFormOpen(true);
  };

  const handleCreateReminder = () => {
    setEditingReminder(null);
    setReminderFormOpen(true);
  };

  const handleEditReminder = (reminder: TRReminder) => {
    setEditingReminder(reminder);
    setReminderFormOpen(true);
  };

  const handleTaskFormClose = () => {
    setTaskFormOpen(false);
    setEditingTask(null);
  };

  const handleReminderFormClose = () => {
    setReminderFormOpen(false);
    setEditingReminder(null);
  };

  const handleDataChanged = () => {
    console.log('T&R Page - Data changed, refreshing...');
    refresh();
  };

  // Show error state if there's an authentication or loading error
  if (error) {
    return (
      <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95">
        <div className="w-full">
          <div className="max-w-4xl mx-auto">
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">{t('error', language)}</div>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={refresh} variant="outline">
                {t('retry', language)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleAutoDeleteToggle = async () => {
    const next = !autoDelete24h;
    setAutoDelete24h(next);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id;
      if (uid) {
        await supabase
          .from('tr_settings')
          .upsert({ user_id: uid, auto_delete_24h_enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.warn('Failed to persist auto-delete setting', e);
    }
    toast.success(next ? t('autoDeleteEnabledToast', language) : t('autoDeleteDisabledToast', language));
  };

  return (
    <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide">
      {/* ── Luxurious gradient header ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#060541] via-[#0a0960] to-[#1a1080] dark:from-[#0c0f14] dark:via-[#111528] dark:to-[#0c0f14]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(210,100%,65%,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_hsla(280,70%,65%,0.1),transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-5 pt-6 pb-5">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
              </h1>
              <p className="text-[13px] text-white/50 mt-1 font-medium">
                {language === 'ar'
                  ? `${tasks.length} مهمة · ${reminders.length} تذكير`
                  : `${tasks.length} tasks · ${reminders.length} reminders`}
              </p>
            </div>
            {(activeTab === 'tasks' || activeTab === 'reminders') && (
              <button
                onClick={activeTab === 'tasks' ? handleCreateTask : handleCreateReminder}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold
                  bg-white text-[#060541] border border-white/80
                  hover:bg-white/90 active:scale-95 transition-all duration-200 touch-manipulation
                  shadow-[0_4px_16px_hsla(0,0%,0%,0.25),0_0_20px_hsla(210,100%,65%,0.2)]"
              >
                <Plus className="w-4 h-4" />
                {activeTab === 'tasks'
                  ? (language === 'ar' ? 'مهمة جديدة' : 'New Task')
                  : (language === 'ar' ? 'تذكير جديد' : 'New Reminder')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-3 space-y-4">
        {/* ── Glass-morphism Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-4 h-12 rounded-2xl p-1.5 gap-1
            bg-white/80 dark:bg-white/[0.06] backdrop-blur-xl
            border border-white/60 dark:border-white/[0.08]
            shadow-[0_4px_24px_hsla(0,0%,0%,0.06)] dark:shadow-[0_4px_24px_hsla(0,0%,0%,0.4)]">
            <TabsTrigger value="activity_main" className="rounded-xl text-[13px] font-bold tracking-wide
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#060541] data-[state=active]:to-[#1a1080]
              dark:data-[state=active]:from-indigo-600 dark:data-[state=active]:to-indigo-500
              data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_hsla(240,80%,30%,0.3)]
              data-[state=inactive]:text-muted-foreground transition-all duration-200">
              {language === 'ar' ? 'النشاط' : 'Activity'}
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-xl text-[13px] font-bold tracking-wide
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#060541] data-[state=active]:to-[#1a1080]
              dark:data-[state=active]:from-indigo-600 dark:data-[state=active]:to-indigo-500
              data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_hsla(240,80%,30%,0.3)]
              data-[state=inactive]:text-muted-foreground transition-all duration-200">
              {language === 'ar' ? 'المهام' : 'Tasks'}
              {tasks.length > 0 && (
                <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full
                  bg-white/20 data-[state=inactive]:bg-[#060541]/10 dark:data-[state=inactive]:bg-indigo-500/20">
                  {tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-xl text-[13px] font-bold tracking-wide
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#060541] data-[state=active]:to-[#1a1080]
              dark:data-[state=active]:from-indigo-600 dark:data-[state=active]:to-indigo-500
              data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_hsla(240,80%,30%,0.3)]
              data-[state=inactive]:text-muted-foreground transition-all duration-200">
              {language === 'ar' ? 'المهام المشتركة' : 'Shared Tasks'}
            </TabsTrigger>
            <TabsTrigger value="reminders" className="rounded-xl text-[13px] font-bold tracking-wide
              data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#060541] data-[state=active]:to-[#1a1080]
              dark:data-[state=active]:from-indigo-600 dark:data-[state=active]:to-indigo-500
              data-[state=active]:text-white data-[state=active]:shadow-[0_2px_12px_hsla(240,80%,30%,0.3)]
              data-[state=inactive]:text-muted-foreground transition-all duration-200">
              {language === 'ar' ? 'التذكيرات' : 'Reminders'}
              {reminders.length > 0 && (
                <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full
                  bg-white/20 data-[state=inactive]:bg-[#060541]/10 dark:data-[state=inactive]:bg-indigo-500/20">
                  {reminders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Activity Tab (main/default) ── */}
          <TabsContent value="activity_main" className="mt-5">
            <ActivityDashboard tasks={tasks} />
          </TabsContent>

          {/* ── Tasks Tab ── */}
          <TabsContent value="tasks" className="mt-5 space-y-4">
            {/* Auto-delete — elegant inline toggle */}
            <div className="flex items-center justify-between px-1 py-2 rounded-xl
              bg-muted/30 dark:bg-white/[0.02] border border-transparent dark:border-white/[0.04]">
              <div className="flex items-center gap-2 pl-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 animate-pulse" />
                <span className="text-[12px] font-medium text-muted-foreground">
                  {language === 'ar' ? 'حذف تلقائي بعد 24 ساعة' : 'Auto-delete after 24h'}
                </span>
              </div>
              <button
                onClick={handleAutoDeleteToggle}
                title={t('autoDeleteTitle', language)}
                className={`relative w-10 h-[22px] rounded-full transition-all duration-300 touch-manipulation flex-shrink-0 mr-1
                  ${autoDelete24h
                    ? 'bg-gradient-to-r from-[#060541] to-indigo-600 dark:from-indigo-600 dark:to-indigo-500 shadow-[0_0_8px_hsla(240,80%,50%,0.3)]'
                    : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-out
                  ${autoDelete24h ? 'translate-x-[18px]' : 'translate-x-0'}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-[#060541]/10 dark:border-indigo-500/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('loadingTasks', language)}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#060541]/10 to-indigo-500/10 dark:from-indigo-500/10 dark:to-purple-500/10 flex items-center justify-center
                    shadow-[0_8px_32px_hsla(240,80%,50%,0.08)]">
                    <ListTodo className="w-9 h-9 text-[#060541]/30 dark:text-indigo-400/40" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
                    <Plus className="w-3.5 h-3.5 text-white" />
                  </div>
                </div>
                <p className="text-lg font-bold text-foreground mb-1.5">
                  {language === 'ar' ? 'لا توجد مهام بعد' : 'No tasks yet'}
                </p>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px] leading-relaxed">
                  {language === 'ar'
                    ? 'ابدأ بإضافة أول مهمة لك وسيتم عرضها هنا.'
                    : 'Create your first task and start organizing your day beautifully.'}
                </p>
                <button
                  onClick={handleCreateTask}
                  className="flex items-center gap-2.5 px-6 py-3 rounded-2xl text-sm font-bold
                    bg-gradient-to-r from-[#060541] to-[#1a1080] dark:from-indigo-600 dark:to-indigo-500
                    text-white shadow-[0_4px_20px_hsla(240,80%,40%,0.3)]
                    hover:shadow-[0_6px_28px_hsla(240,80%,40%,0.4)] active:scale-95 transition-all duration-200 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  {t('createTask', language)}
                </button>
              </div>
            ) : (
              <TaskList
                tasks={tasks}
                onTaskEdit={handleEditTask}
                onTasksChanged={handleDataChanged}
              />
            )}
          </TabsContent>

          {/* ── Reminders Tab ── */}
          <TabsContent value="reminders" className="mt-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-[#060541]/10 dark:border-indigo-500/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('loadingReminders', language)}</p>
              </div>
            ) : (
              <ReminderList
                reminders={reminders}
                onReminderEdit={handleEditReminder}
                onRemindersChanged={handleDataChanged}
              />
            )}
          </TabsContent>

          {/* ── Activity Tab ── */}
          <TabsContent value="activity" className="mt-5 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-[#060541]/10 dark:border-indigo-500/10" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{t('loadingActivity', language)}</p>
              </div>
            ) : (
              <SharedTasksTab tasks={tasks} onTasksChanged={handleDataChanged} incomingShareLink={incomingShareLink} />
            )}
          </TabsContent>
        </Tabs>

        {/* Forms */}
        <TaskForm
          isOpen={taskFormOpen}
          onClose={handleTaskFormClose}
          task={editingTask}
          onTaskSaved={handleDataChanged}
        />
        <ReminderForm
          isOpen={reminderFormOpen}
          onClose={handleReminderFormClose}
          reminder={editingReminder}
          onReminderSaved={handleDataChanged}
        />
      </div>
    </div>
  );
}
