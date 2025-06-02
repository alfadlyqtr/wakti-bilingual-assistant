
import React from "react";
import { Button } from "@/components/ui/button";
import { BellRing, Hand } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";

interface RemindersWidgetProps {
  isLoading: boolean;
  reminders: any[];
  language: 'en' | 'ar';
}

export const RemindersWidget: React.FC<RemindersWidgetProps> = ({ isLoading, reminders, language }) => {
  const navigate = useNavigate();
  const hasReminders = reminders && reminders.length > 0;

  return (
    <div className={`relative ${hasReminders ? 'p-4' : 'p-2'}`}>
      {/* Drag handle */}
      <div className="absolute top-1 left-1 z-20 p-1 rounded-md bg-muted/60 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-grab active:cursor-grabbing">
        <Hand className="h-3 w-3" />
      </div>
      
      <div className={hasReminders ? "ml-10" : "ml-8"}>
        <h3 className={`font-medium ${hasReminders ? 'mb-2' : 'mb-1'} ${hasReminders ? 'text-base' : 'text-sm'}`}>
          {t("reminders", language)}
        </h3>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ) : hasReminders ? (
          <div className="space-y-2">
            {reminders.map((reminder: any) => (
              <div key={reminder.id} className="flex justify-between items-center">
                <div>{reminder.title}</div>
                <div className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                  {format(new Date(reminder.due_date), "MMM d")}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/tasks')}>
              {t("reminders_view_all", language)}
            </Button>
          </div>
        ) : (
          <div className="text-center py-1">
            <BellRing className="mx-auto h-4 w-4 text-muted-foreground opacity-50 mb-1" />
            <p className="text-xs text-muted-foreground mb-1">{t("noRemindersYet", language)}</p>
            <Button variant="outline" size="sm" className="text-xs px-2 py-1 h-auto" onClick={() => navigate('/tasks')}>
              {t("createReminder", language)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
