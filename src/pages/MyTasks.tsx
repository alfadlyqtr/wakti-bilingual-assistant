
import React, { useState } from 'react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { MyTasksProvider } from '@/contexts/MyTasksContext';
import TasksList from '@/components/my-tasks/TasksList';
import TaskCreationForm from '@/components/my-tasks/TaskCreationForm';
import { Button } from '@/components/ui/button';
import { Plus, ListTodo, Bell } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const MyTasks: React.FC = () => {
  const { language } = useTheme();
  const [activeTab, setActiveTab] = useState<'all' | 'tasks' | 'reminders'>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [defaultTaskType, setDefaultTaskType] = useState<'task' | 'reminder'>('task');

  const handleCreateTask = (type: 'task' | 'reminder') => {
    setDefaultTaskType(type);
    setShowCreateForm(true);
  };

  return (
    <MyTasksProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">{t('myTasks', language)}</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreateTask('reminder')}
                className="flex items-center gap-2"
              >
                <Bell className="h-4 w-4" />
                {t('reminder', language)}
              </Button>
              <Button
                size="sm"
                onClick={() => handleCreateTask('task')}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('task', language)}
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">{t('allItems', language)}</TabsTrigger>
              <TabsTrigger value="tasks">{t('tasks', language)}</TabsTrigger>
              <TabsTrigger value="reminders">{t('reminders', language)}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <TasksList filter={activeTab} />
        </div>

        {/* Create Task Dialog */}
        <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
          <DialogContent className="sm:max-w-md p-0">
            <DialogHeader className="p-4 pb-0">
              <DialogTitle>
                {t(defaultTaskType === 'task' ? 'createTask' : 'createReminder', language)}
              </DialogTitle>
            </DialogHeader>
            <div className="p-4 pt-0">
              <TaskCreationForm
                defaultType={defaultTaskType}
                onSuccess={() => setShowCreateForm(false)}
                onCancel={() => setShowCreateForm(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MyTasksProvider>
  );
};

export default MyTasks;
