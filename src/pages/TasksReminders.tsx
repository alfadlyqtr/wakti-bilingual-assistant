
import React, { useState, useEffect } from 'react';
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
import { useTRData } from '@/hooks/useTRData';
import { PageTitle } from '@/components/PageTitle';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function TasksReminders() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState('tasks');
  const { tasks, reminders, loading, error, refresh } = useTRData();
  // Auto-delete toggle (24h after completion). Default ON. Persist to localStorage.
  const [autoDelete24h, setAutoDelete24h] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tr:autoDelete24hEnabled');
      return saved === null ? true : saved === 'true';
    } catch { return true; }
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
    <div className="flex-1 overflow-y-auto pb-28 scrollbar-hide bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              {language === 'ar' ? 'المهام والتذكيرات' : 'Tasks & Reminders'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === 'ar'
                ? `${tasks.length} مهمة · ${reminders.length} تذكير`
                : `${tasks.length} tasks · ${reminders.length} reminders`}
            </p>
          </div>
          <button
            onClick={activeTab === 'tasks' ? handleCreateTask : activeTab === 'reminders' ? handleCreateReminder : undefined}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-[#060541] text-white dark:bg-indigo-500
              hover:opacity-90 active:scale-95 transition-all duration-150 touch-manipulation shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'tasks'
              ? (language === 'ar' ? 'مهمة' : 'New Task')
              : activeTab === 'reminders'
                ? (language === 'ar' ? 'تذكير' : 'Reminder')
                : null}
          </button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-10 rounded-xl bg-muted/60 p-1 gap-1">
            <TabsTrigger value="tasks" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {language === 'ar' ? 'المهام' : 'Tasks'}
              {tasks.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#060541]/10 dark:bg-indigo-500/20 text-[#060541] dark:text-indigo-300">
                  {tasks.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reminders" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {language === 'ar' ? 'التذكيرات' : 'Reminders'}
              {reminders.length > 0 && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#060541]/10 dark:bg-indigo-500/20 text-[#060541] dark:text-indigo-300">
                  {reminders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-lg text-xs font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm">
              {language === 'ar' ? 'النشاط' : 'Activity'}
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4 space-y-4">
            {/* Auto-delete toggle — subtle, not a big button */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {language === 'ar' ? 'حذف تلقائي بعد 24 ساعة من الإتمام' : 'Auto-delete 24h after completion'}
              </span>
              <button
                onClick={handleAutoDeleteToggle}
                title={t('autoDeleteTitle', language)}
                className={`relative w-9 h-5 rounded-full transition-colors duration-200 touch-manipulation flex-shrink-0
                  ${autoDelete24h ? 'bg-[#060541] dark:bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                  ${autoDelete24h ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#060541]/20 dark:border-indigo-500/20 border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                <p className="text-xs text-muted-foreground">{t('loadingTasks', language)}</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#060541]/5 dark:bg-indigo-500/10 flex items-center justify-center mb-4">
                  <ListTodo className="w-8 h-8 text-[#060541]/40 dark:text-indigo-400/60" />
                </div>
                <p className="font-semibold text-foreground mb-1">
                  {language === 'ar' ? 'لا توجد مهام بعد' : 'No tasks yet'}
                </p>
                <p className="text-xs text-muted-foreground mb-5 max-w-xs leading-relaxed">
                  {language === 'ar'
                    ? 'ابدأ بإضافة أول مهمة لك وسيتم عرضها هنا.'
                    : 'Create your first task and it will appear here.'}
                </p>
                <button
                  onClick={handleCreateTask}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                    bg-[#060541] text-white dark:bg-indigo-500
                    hover:opacity-90 active:scale-95 transition-all touch-manipulation"
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

          {/* Reminders Tab */}
          <TabsContent value="reminders" className="mt-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#060541]/20 dark:border-indigo-500/20 border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                <p className="text-xs text-muted-foreground">{t('loadingReminders', language)}</p>
              </div>
            ) : (
              <ReminderList
                reminders={reminders}
                onReminderEdit={handleEditReminder}
                onRemindersChanged={handleDataChanged}
              />
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="mt-4 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#060541]/20 dark:border-indigo-500/20 border-t-[#060541] dark:border-t-indigo-500 animate-spin" />
                <p className="text-xs text-muted-foreground">{t('loadingActivity', language)}</p>
              </div>
            ) : (
              <ActivityMonitor tasks={tasks} onTasksChanged={handleDataChanged} />
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
