
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { TRService, TRTask, TRReminder } from "@/services/trService";
import { Hand, CheckSquare, Bell, Calendar, Plus } from "lucide-react";

interface TRWidgetProps {
  language: 'en' | 'ar';
}

export const TRWidget: React.FC<TRWidgetProps> = ({ language }) => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TRTask[]>([]);
  const [reminders, setReminders] = useState<TRReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksData, remindersData] = await Promise.all([
          TRService.getTasks(),
          TRService.getReminders()
        ]);
        console.log('T&R Widget fetched tasks:', tasksData.length);
        console.log('T&R Widget fetched reminders:', remindersData.length);
        setTasks(tasksData);
        setReminders(remindersData);
      } catch (error) {
        console.error('Error fetching T&R data for widget:', error);
        setTasks([]);
        setReminders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const pendingTasks = tasks.filter(task => !task.completed);
  const todayReminders = reminders.filter(reminder => {
    const today = new Date().toISOString().split('T')[0];
    return reminder.due_date === today;
  });

  const hasContent = pendingTasks.length > 0 || todayReminders.length > 0;

  return (
    <div className="relative group">
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-red-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-green-500/10 via-transparent to-red-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className="absolute top-2 left-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110">
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <Bell className="h-4 w-4 text-red-500" />
          </div>
          <h3 className="font-semibold text-lg bg-gradient-to-r from-green-500 to-red-500 bg-clip-text text-transparent">
            Tasks & Reminders
          </h3>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : hasContent ? (
          <div className="space-y-4">
            {/* Tasks Section */}
            {pendingTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <CheckSquare className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500 dark:text-green-400">
                    Tasks ({pendingTasks.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {pendingTasks.slice(0, 2).map((task) => (
                    <div 
                      key={task.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 backdrop-blur-sm border border-green-500/20"
                    >
                      <span className="text-sm truncate flex-1 text-foreground font-medium">{task.title}</span>
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <Calendar className="h-3 w-3" />
                          {new Date(task.due_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders Section */}
            {todayReminders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500 dark:text-red-400">
                    Today's Reminders ({todayReminders.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {todayReminders.slice(0, 2).map((reminder) => (
                    <div 
                      key={reminder.id} 
                      className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-500/20"
                    >
                      <span className="text-sm truncate flex-1 text-foreground font-medium">{reminder.title}</span>
                      {reminder.due_time && (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                          {reminder.due_time}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full bg-white/10 backdrop-blur-sm border-white/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-300 text-foreground font-medium" 
              onClick={() => navigate('/tr')}
            >
              View All T&R
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="flex items-center justify-center gap-2 mb-3 opacity-50">
              <CheckSquare className="h-6 w-6 text-green-500" />
              <Bell className="h-6 w-6 text-red-500" />
            </div>
            <p className="text-sm text-foreground/70 mb-3 font-medium">No pending tasks or reminders</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-300 text-foreground font-medium" 
              onClick={() => navigate('/tr')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
