
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TRService, TRTask, TRReminder } from '@/services/trService';
import { TaskForm } from '@/components/tr/TaskForm';
import { ReminderForm } from '@/components/tr/ReminderForm';
import { TaskList } from '@/components/tr/TaskList';
import { ReminderList } from '@/components/tr/ReminderList';
import { ActivityMonitor } from '@/components/tr/ActivityMonitor';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function TasksReminders() {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState('tasks');
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [reminderFormOpen, setReminderFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TRTask | null>(null);
  const [editingReminder, setEditingReminder] = useState<TRReminder | null>(null);

  useEffect(() => {
    loadData();
    
    // Check authentication status
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      console.log('T&R Page - Auth check:', { user: user?.id, error });
      
      if (error) {
        console.error('T&R Page - Auth error:', error);
        setError('Authentication error. Please refresh the page.');
      } else if (!user) {
        console.error('T&R Page - No user authenticated');
        setError('Please log in to view your tasks and reminders.');
      }
    } catch (err) {
      console.error('T&R Page - Auth check failed:', err);
      setError('Failed to verify authentication status.');
    }
  };

  const loadData = async () => {
    console.log('T&R Page - Starting data load');
    setLoading(true);
    setError(null);
    
    try {
      console.log('T&R Page - Fetching tasks and reminders...');
      const [tasksData, remindersData] = await Promise.all([
        TRService.getTasks(),
        TRService.getReminders()
      ]);
      
      console.log('T&R Page - Data loaded successfully:', {
        tasksCount: tasksData.length,
        remindersCount: remindersData.length
      });
      
      setTasks(tasksData);
      setReminders(remindersData);
    } catch (error) {
      console.error('T&R Page - Error loading data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
      setError(errorMessage);
      toast.error(`Error loading T&R data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

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
    console.log('T&R Page - Data changed, reloading...');
    loadData();
  };

  // Show error state if there's an authentication or loading error
  if (error) {
    return (
      <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95">
        <div className="max-w-md mx-auto">
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">Error</div>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28 bg-gradient-to-b from-background to-background/95 scrollbar-hide">
      <div className="max-w-md mx-auto space-y-4">
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            Debug: Tasks={tasks.length}, Reminders={reminders.length}, Loading={loading.toString()}
          </div>
        )}

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
                <p className="text-sm text-muted-foreground mt-2">Loading tasks...</p>
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
                <p className="text-sm text-muted-foreground mt-2">Loading reminders...</p>
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
              <Button onClick={loadData} variant="outline" size="sm">
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading activity...</p>
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
