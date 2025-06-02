
import React from 'react';
import { useMyTasks } from '@/contexts/MyTasksContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import TaskCard from './TaskCard';
import ReminderCard from './ReminderCard';
import { Loader2, ListTodo } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface TasksListProps {
  filter: 'all' | 'tasks' | 'reminders';
}

const TasksList: React.FC<TasksListProps> = ({ filter }) => {
  const { tasks, loading, error, clearError, fetchTasks } = useMyTasks();
  const { language } = useTheme();

  const filteredTasks = tasks.filter(task => {
    if (filter === 'tasks') return task.task_type === 'task';
    if (filter === 'reminders') return task.task_type === 'reminder';
    return true;
  });

  const pendingTasks = filteredTasks.filter(task => task.status === 'pending');
  const overdueTasks = filteredTasks.filter(task => task.status === 'overdue');
  const completedTasks = filteredTasks.filter(task => task.status === 'completed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>{t('loading', language)}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => {
              clearError();
              fetchTasks();
            }}>
              {t('retry', language)}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <ListTodo className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {t(filter === 'tasks' ? 'noTasksYet' : filter === 'reminders' ? 'noRemindersYet' : 'noItemsYet', language)}
        </h3>
        <p className="text-muted-foreground mb-4">
          {t('createFirstItem', language)}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
            ⚠️ {t('overdue', language)} ({overdueTasks.length})
          </h3>
          <div className="space-y-2">
            {overdueTasks.map(task => 
              task.task_type === 'task' ? (
                <TaskCard key={task.id} task={task} />
              ) : (
                <ReminderCard key={task.id} reminder={task} />
              )
            )}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            📋 {t('pending', language)} ({pendingTasks.length})
          </h3>
          <div className="space-y-2">
            {pendingTasks.map(task => 
              task.task_type === 'task' ? (
                <TaskCard key={task.id} task={task} />
              ) : (
                <ReminderCard key={task.id} reminder={task} />
              )
            )}
          </div>
        </div>
      )}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
            ✅ {t('completed', language)} ({completedTasks.length})
          </h3>
          <div className="space-y-2">
            {completedTasks.map(task => 
              task.task_type === 'task' ? (
                <TaskCard key={task.id} task={task} />
              ) : (
                <ReminderCard key={task.id} reminder={task} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksList;
