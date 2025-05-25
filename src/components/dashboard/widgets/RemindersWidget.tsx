
import React from "react";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";
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

  return (
    <div className="p-4">
      <h3 className="font-medium mb-2">{t("reminders", language)}</h3>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : reminders && reminders.length > 0 ? (
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
        <div className="text-center py-3">
          <BellRing className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
          <p className="text-sm text-muted-foreground">{t("noRemindersYet", language)}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/tasks')}>
            {t("createReminder", language)}
          </Button>
        </div>
      )}
    </div>
  );
};
