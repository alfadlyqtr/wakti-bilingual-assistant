
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

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95 scrollbar-hide">
      <div className="w-full space-y-6">
        <div className="max-w-4xl mx-auto">
          {/* Ensure page starts at the title on load */}
          <div>
            <PageTitle
              title={t('tasks', language)}
              Icon={ListTodo}
              colorClass="nav-icon-tr"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tasks">
                {t('tasks', language)} ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="reminders">
                {t('reminders', language)} ({reminders.length})
              </TabsTrigger>
              <TabsTrigger
                value="activity"
                className="text-[11px] leading-snug whitespace-normal px-3 py-2 sm:text-sm sm:leading-tight"
              >
                {t('activityMonitor', language)}
              </TabsTrigger>
            </TabsList>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs">
                  <Button
                    variant={autoDelete24h ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setAutoDelete24h((v) => {
                        const next = !v;
                        (async () => {
                          try {
                            const { data: { user } } = await supabase.auth.getUser();
                            const uid = user?.id;
                            if (uid) {
                              const { error } = await supabase
                                .from('tr_settings')
                                .upsert({ user_id: uid, auto_delete_24h_enabled: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
                              if (error) throw error;
                            }
                          } catch (e) {
                            console.warn('Failed to persist auto-delete setting', e);
                          }
                          toast.success(next ? 'Auto-delete: ON (delete completed tasks after 24h)' : 'Auto-delete: OFF');
                        })();
                        return next;
                      });
                    }}
                    className="h-8"
                    title="Auto-delete completed tasks after 24 hours"
                  >
                    {autoDelete24h ? 'Auto-delete 24h: ON' : 'Auto-delete 24h: OFF'}
                  </Button>
                </div>
                <Button onClick={handleCreateTask} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('createTask', language)}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">{t('loadingTasks', language)}</p>
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center text-muted-foreground">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-primary/40 bg-primary/5">
                    <ListTodo className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm mb-1 font-medium">
                    {language === 'ar' ? 'لا توجد مهام بعد' : 'No tasks yet'}
                  </p>
                  <p className="text-xs mb-4 max-w-xs">
                    {language === 'ar'
                      ? 'ابدأ بإضافة أول مهمة لك، وسيتم عرضها هنا بشكل منظم مع التذكيرات والمتابعة.'
                      : 'Start by creating your first task. It will appear here with reminders and activity tracking.'}
                  </p>
                  <Button size="sm" onClick={handleCreateTask} className="mt-1">
                    <Plus className="w-4 h-4 mr-2" />
                    {t('createTask', language)}
                  </Button>
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
            <TabsContent value="reminders" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('reminders', language)}</h2>
                <Button onClick={handleCreateReminder} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t('createReminder', language)}
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">{t('loadingReminders', language)}</p>
                </div>
              ) : (
                <ReminderList 
                  reminders={reminders} 
                  onReminderEdit={handleEditReminder}
                  onRemindersChanged={handleDataChanged}
                />
              )}
            </TabsContent>

            {/* Activity Monitor Tab */}
            <TabsContent value="activity" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('activityMonitor', language)}</h2>
                {/* Removed outer Refresh to avoid duplicate with ActivityMonitor's internal refresh */}
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">{t('loadingActivity', language)}</p>
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
    </div>
  );
}
