
import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { TasksWidget, CalendarWidget, RemindersWidget } from "./widgets";
import { useTheme } from "@/providers/ThemeProvider";

interface DashboardWidgetsProps {
  tasks: any[];
  reminders: any[];
  isLoading: boolean;
}

export const DashboardWidgets: React.FC<DashboardWidgetsProps> = ({ 
  tasks, 
  reminders, 
  isLoading 
}) => {
  const { language } = useTheme();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <TasksWidget isLoading={isLoading} tasks={tasks} language={language} />
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <CalendarWidget 
          isLoading={isLoading} 
          tasks={tasks} 
          reminders={reminders} 
          language={language} 
        />
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <RemindersWidget isLoading={isLoading} reminders={reminders} language={language} />
      </div>
    </div>
  );
};
