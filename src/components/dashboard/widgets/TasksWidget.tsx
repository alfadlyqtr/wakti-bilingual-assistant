
import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
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

  return (
    <div className="p-4">
      <h3 className="font-medium mb-3">{t("tasks", language)}</h3>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : tasks && tasks.length > 0 ? (
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
          <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/tasks')}>
            {t("tasks_view_all", language)}
          </Button>
        </div>
      ) : (
        <div className="text-center py-3">
          <CheckCircle className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm text-muted-foreground">{t("noTasksYet", language)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/tasks')}>
            {t("createTask", language)}
          </Button>
        </div>
      )}
    </div>
  );
};
