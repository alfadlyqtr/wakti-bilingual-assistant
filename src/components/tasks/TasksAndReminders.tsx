import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task, Reminder, Subtask, useTaskReminder } from '@/contexts/TaskReminderContext';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import TaskItem from './TaskItem';
import ReminderItem from './ReminderItem';
import TaskForm from './TaskForm';
import ReminderForm from './ReminderForm';
import ShareTaskDialog from './ShareTaskDialog';
import {
  ListFilter,
  Plus,
  Search,
  CirclePlus,
  Check,
  AlertTriangle,
  Clock,
  Sparkle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TasksAndReminders: React.FC = () => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const { 
    tasks, reminders, loading,
    createTask, updateTask, deleteTask,
    createSubtask, updateSubtask,
    createReminder, updateReminder, deleteReminder
  } = useTaskReminder();
  
  const [activeTab, setActiveTab] = useState<string>('tasks');
  const [taskFilter, setTaskFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isTaskFormOpen, setIsTaskFormOpen] = useState<boolean>(false);
  const [isReminderFormOpen, setIsReminderFormOpen] = useState<boolean>(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [currentReminder, setCurrentReminder] = useState<Reminder | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState<boolean>(false);
  const [taskToShare, setTaskToShare] = useState<Task | null>(null);

  // Filter tasks based on status and search query
  const filteredTasks = tasks
    .filter(task => {
      if (searchQuery) {
        return task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
               (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      return true;
    })
    .filter(task => {
      switch (taskFilter) {
        case 'completed': return task.status === 'completed';
        case 'pending': return task.status === 'pending';
        case 'overdue': return task.status === 'overdue';
        default: return true;
      }
    });

  // Filter reminders based on search query
  const filteredReminders = reminders
    .filter(reminder => {
      if (searchQuery) {
        return reminder.title.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });

  // Handle task completion toggle
  const handleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    await updateTask(taskId, {
      status: isCompleted ? 'pending' : 'completed'
    });
  };

  // Handle task edit
  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setIsTaskFormOpen(true);
  };

  // Handle task deletion
  const handleDeleteTask = async (taskId: string) => {
    await deleteTask(taskId);
  };

  // Handle task sharing
  const handleShareTask = (task: Task) => {
    setTaskToShare(task);
    setShareDialogOpen(true);
  };

  // Handle reminder edit
  const handleEditReminder = (reminder: Reminder) => {
    setCurrentReminder(reminder);
    setIsReminderFormOpen(true);
  };

  // Handle reminder deletion
  const handleDeleteReminder = async (reminderId: string) => {
    await deleteReminder(reminderId);
  };

  // Handle task form submission
  const handleTaskSubmit = async (taskData: Task, subtasks: Omit<Subtask, 'id' | 'task_id'>[]) => {
    if (currentTask) {
      // Update existing task
      await updateTask(currentTask.id, taskData);
      
      // Handle subtasks - we would need more logic here for updating/deleting subtasks
      // For now, we're keeping it simple
    } else {
      // Create new task
      await createTask(taskData, subtasks);
    }
    
    setCurrentTask(null);
    setIsTaskFormOpen(false);
  };

  // Handle reminder form submission
  const handleReminderSubmit = async (reminderData: Reminder) => {
    if (currentReminder) {
      // Update existing reminder
      await updateReminder(currentReminder.id, reminderData);
    } else {
      // Create new reminder
      await createReminder(reminderData);
    }
    
    setCurrentReminder(null);
    setIsReminderFormOpen(false);
  };

  // Handle Smart Task button click to open AI Assistant
  const handleSmartTaskClick = () => {
    navigate('/assistant', { state: { preloadedText: "Ready to create your task…" } });
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <Tabs 
          defaultValue="tasks" 
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="tasks">{t('tasks', language)}</TabsTrigger>
              <TabsTrigger value="reminders">{t('reminders', language)}</TabsTrigger>
            </TabsList>
          </div>
          
          <div className="mb-4">
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={activeTab === 'tasks' ? t('searchTasks', language) : t('searchReminders', language)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              
              {activeTab === 'tasks' && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setTaskFilter(prev => 
                    prev === 'all' ? 'pending' : 
                    prev === 'pending' ? 'completed' : 
                    prev === 'completed' ? 'overdue' : 'all'
                  )}
                  className="relative"
                >
                  <ListFilter className="h-4 w-4" />
                  {taskFilter !== 'all' && (
                    <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[8px] w-4 h-4 flex items-center justify-center rounded-full">
                      {taskFilter === 'pending' ? <Clock className="w-2.5 h-2.5" /> : 
                       taskFilter === 'completed' ? <Check className="w-2.5 h-2.5" /> : 
                       <AlertTriangle className="w-2.5 h-2.5" />}
                    </span>
                  )}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => {
                  if (activeTab === 'tasks') {
                    setCurrentTask(null);
                    setIsTaskFormOpen(true);
                  } else {
                    setCurrentReminder(null);
                    setIsReminderFormOpen(true);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {activeTab === 'tasks' && (
              <div className="text-sm text-muted-foreground">
                {taskFilter === 'all' ? t('allTasks', language) :
                 taskFilter === 'pending' ? t('pendingTasks', language) :
                 taskFilter === 'completed' ? t('completedTasks', language) :
                 t('overdueItems', language)}
                 : {filteredTasks.length}
              </div>
            )}
            {activeTab === 'reminders' && (
              <div className="text-sm text-muted-foreground">
                {t('reminders', language)}: {filteredReminders.length}
              </div>
            )}
          </div>

          <TabsContent value="tasks" className="m-0 overflow-hidden flex flex-col flex-1">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredTasks.length > 0 ? (
              <div className="overflow-y-auto pb-20">
                <AnimatePresence>
                  {filteredTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={handleTaskComplete}
                      onEdit={handleEditTask}
                      onDelete={handleDeleteTask}
                      onShare={handleShareTask}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
                <CirclePlus className="h-12 w-12 mb-2" />
                <p className="text-center mb-1">{t('noTasks', language)}</p>
                <p className="text-center text-sm">
                  {t('createYourFirst', language)} {t('tasks', language).toLowerCase()}
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => {
                    setCurrentTask(null);
                    setIsTaskFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createTask', language)}
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reminders" className="m-0 overflow-hidden flex flex-col flex-1">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredReminders.length > 0 ? (
              <div className="overflow-y-auto pb-20">
                <AnimatePresence>
                  {filteredReminders.map((reminder) => (
                    <ReminderItem
                      key={reminder.id}
                      reminder={reminder}
                      onEdit={handleEditReminder}
                      onDelete={handleDeleteReminder}
                    />
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
                <CirclePlus className="h-12 w-12 mb-2" />
                <p className="text-center mb-1">{t('noReminders', language)}</p>
                <p className="text-center text-sm">
                  {t('createYourFirst', language)} {t('reminders', language).toLowerCase()}
                </p>
                <Button 
                  className="mt-4" 
                  onClick={() => {
                    setCurrentReminder(null);
                    setIsReminderFormOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createReminder', language)}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Smart Task Button - fixed at bottom */}
      <div className="fixed bottom-20 right-4 z-10">
        <Button 
          onClick={handleSmartTaskClick}
          className="rounded-full h-12 w-12 shadow-lg flex items-center justify-center"
        >
          <Sparkle className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Task Form Dialog */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>
              {currentTask ? t('edit', language) : t('createTask', language)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-2">
            <TaskForm 
              existingTask={currentTask || undefined}
              onSubmit={handleTaskSubmit}
              onCancel={() => {
                setCurrentTask(null);
                setIsTaskFormOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Reminder Form Dialog */}
      <Dialog open={isReminderFormOpen} onOpenChange={setIsReminderFormOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>
              {currentReminder ? t('edit', language) : t('createReminder', language)}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-2">
            <ReminderForm 
              existingReminder={currentReminder || undefined}
              onSubmit={handleReminderSubmit}
              onCancel={() => {
                setCurrentReminder(null);
                setIsReminderFormOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Share Task Dialog */}
      <ShareTaskDialog 
        task={taskToShare}
        isOpen={shareDialogOpen}
        onClose={() => {
          setShareDialogOpen(false);
          setTaskToShare(null);
        }}
      />
    </div>
  );
};

export default TasksAndReminders;
