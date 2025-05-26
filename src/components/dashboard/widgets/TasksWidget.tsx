
import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Hand } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";

interface TasksWidgetProps {
  isLoading: boolean;
  tasks: any[];
  language: 'en' | 'ar';
}

export const TasksWidget: React.FC<TasksWidgetProps> = ({ isLoading, tasks, language }) => {
  const navigate = useNavigate();
  const hasTasks = tasks && tasks.length > 0;

  return (
    <div className={`relative ${hasTasks ? 'p-4' : 'p-3'}`}>
      {/* Drag handle */}
      <div className="absolute top-2 left-2 z-20 p-1 rounded-md bg-muted/60 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-grab active:cursor-grabbing">
        <Hand className="h-4 w-4" />
      </div>
      
      <div className="ml-10">
        <h3 className="font-medium mb-3">{t("tasks", language)}</h3>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : hasTasks ? (
          <div className="space-y-2">
            {tasks.map((task: any) => (
              <div key={task.id} className="flex items-center">
                <div className={`h-2 w-2 rounded-full mr-2 ${
                  task.priority === 'urgent' ? 'bg-red-500' : 
                  task.priority === 'high' ? 'bg-orange-400' : 
                  task.priority === 'low' ? 'bg-blue-400' : 'bg-yellow-400'
                }`}></div>
                <span className="text-sm">{task.title}</span>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/tasks-reminders')}>
              {t("tasks_view_all", language)}
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <CheckCircle className="mx-auto h-6 w-6 text-muted-foreground opacity-50 mb-1" />
            <p className="text-xs text-muted-foreground mb-2">{t("noTasksYet", language)}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/tasks-reminders')}>
              {t("createTask", language)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
