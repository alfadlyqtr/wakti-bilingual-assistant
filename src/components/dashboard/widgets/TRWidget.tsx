
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, CheckSquare, Bell, Plus, AlertTriangle, Clock } from "lucide-react";
import { useOptimizedTRData } from "@/hooks/useOptimizedTRData";
import { format, isToday, isPast, parseISO } from "date-fns";

interface TRWidgetProps {
  language: 'en' | 'ar';
}

export const TRWidget: React.FC<TRWidgetProps> = React.memo(({ language }) => {
  const navigate = useNavigate();
  const { tasks, reminders, loading } = useOptimizedTRData();

  // Calculate stats
  const pendingTasks = tasks.filter(task => !task.completed);
  const overdueTasks = pendingTasks.filter(task => 
    task.due_date && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date))
  );
  const todayTasks = pendingTasks.filter(task => 
    task.due_date && isToday(parseISO(task.due_date))
  );

  // For reminders, we show all active reminders (they don't have completion status)
  const activeReminders = reminders.filter(reminder => 
    !reminder.snoozed_until || (reminder.snoozed_until && isPast(parseISO(reminder.snoozed_until)))
  );
  const overdueReminders = activeReminders.filter(reminder => 
    reminder.due_date && isPast(parseISO(reminder.due_date)) && !isToday(parseISO(reminder.due_date))
  );
  const todayReminders = activeReminders.filter(reminder => 
    reminder.due_date && isToday(parseISO(reminder.due_date))
  );

  // Get next upcoming item
  const upcomingItems = [
    ...pendingTasks.filter(task => task.due_date).map(task => ({
      ...task,
      type: 'task' as const
    })),
    ...activeReminders.filter(reminder => reminder.due_date).map(reminder => ({
      ...reminder,
      type: 'reminder' as const
    }))
  ]
    .filter(item => item.due_date && !isPast(parseISO(item.due_date)))
    .sort((a, b) => parseISO(a.due_date!).getTime() - parseISO(b.due_date!).getTime())
    .slice(0, 2);

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background - Always showing enhanced colors */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-red-500/10 rounded-xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/15 via-transparent to-red-500/15 rounded-xl"></div>
      
      {/* Drag handle with glass effect - Always enhanced */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 bg-primary/20 border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <Bell className="h-4 w-4 text-red-500" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">
            {t("tasksReminders", language)}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-bold text-lg text-green-500">{pendingTasks.length}</div>
                    <div className="text-xs text-green-600">{language === 'ar' ? 'مهام' : 'Tasks'}</div>
                  </div>
                </div>
                {todayTasks.length > 0 && (
                  <div className="mt-1 text-xs text-orange-600">
                    {todayTasks.length} {language === 'ar' ? 'اليوم' : 'today'}
                  </div>
                )}
                {overdueTasks.length > 0 && (
                  <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueTasks.length} {language === 'ar' ? 'متأخر' : 'overdue'}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-red-500" />
                  <div>
                    <div className="font-bold text-lg text-red-500">{activeReminders.length}</div>
                    <div className="text-xs text-red-600">{language === 'ar' ? 'تذكيرات' : 'Reminders'}</div>
                  </div>
                </div>
                {todayReminders.length > 0 && (
                  <div className="mt-1 text-xs text-orange-600">
                    {todayReminders.length} {language === 'ar' ? 'اليوم' : 'today'}
                  </div>
                )}
                {overdueReminders.length > 0 && (
                  <div className="mt-1 text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueReminders.length} {language === 'ar' ? 'متأخر' : 'overdue'}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming Items */}
            {upcomingItems.length > 0 && (
              <div className="space-y-2 mb-4">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {language === 'ar' ? 'القادم' : 'Next Up'}
                </h4>
                {upcomingItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-white/10 backdrop-blur-sm">
                    {item.type === 'task' ? 
                      <CheckSquare className="h-3 w-3 text-green-500 flex-shrink-0" /> : 
                      <Bell className="h-3 w-3 text-red-500 flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(item.due_date!), "MMM d")}
                        {item.due_time && ` • ${item.due_time}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Button 
          variant="outline" 
          size="sm" 
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 bg-primary/20 border-primary/40 transition-all duration-300 text-foreground font-medium" 
          onClick={() => navigate('/tr')}
        >
          <Plus className="h-4 w-4 mr-2" />
          {language === 'ar' ? 'فتح المهام والتذكيرات' : 'Open T&R'}
        </Button>
      </div>
    </div>
  );
});

TRWidget.displayName = 'TRWidget';
