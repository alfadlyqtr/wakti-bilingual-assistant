
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
    <div className={`relative ${hasReminders ? 'p-4' : 'p-3'}`}>
      {/* Drag handle */}
      <div className="absolute top-2 left-2 z-20 p-1 rounded-md bg-muted/60 hover:bg-primary/80 hover:text-primary-foreground transition-colors cursor-grab active:cursor-grabbing">
        <Hand className="h-4 w-4" />
      </div>
      
      <div className="ml-10">
        <h3 className="font-medium mb-2">{t("reminders", language)}</h3>
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
          <div className="text-center py-2">
            <BellRing className="mx-auto h-6 w-6 text-muted-foreground opacity-50 mb-1" />
            <p className="text-xs text-muted-foreground mb-2">{t("noRemindersYet", language)}</p>
            <Button variant="outline" size="sm" onClick={() => navigate('/tasks')}>
              {t("createReminder", language)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
