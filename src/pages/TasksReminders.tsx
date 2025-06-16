
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRTask, TRReminder } from '@/services/trService';
import { TaskForm } from '@/components/tr/TaskForm';
import { ReminderForm } from '@/components/tr/ReminderForm';
import { TaskList } from '@/components/tr/TaskList';
import { ReminderList } from '@/components/tr/ReminderList';
import { ActivityMonitor } from '@/components/tr/ActivityMonitor';
import { useTRData } from '@/hooks/useTRData';

export default function TasksReminders() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState('tasks');
  const { tasks, reminders, loading, error, refresh } = useTRData();
  
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
        <div className="max-w-md mx-auto">
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">{t('error', language)}</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={refresh} variant="outline">
              {t('retry', language)}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95 scrollbar-hide">
      <div className="max-w-md mx-auto space-y-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">
              {t('tasks', language)} ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="reminders">
              {t('reminders', language)} ({reminders.length})
            </TabsTrigger>
            <TabsTrigger value="activity">{t('activityMonitor', language)}</TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('tasks', language)}</h2>
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
              <Button onClick={refresh} variant="outline" size="sm">
                {t('refresh', language)}
              </Button>
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
  );
}
