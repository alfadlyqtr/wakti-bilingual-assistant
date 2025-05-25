
import React, { useState } from "react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isSameDay } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Bell, Plus } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

export function UnifiedCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const navigate = useNavigate();
  const { language } = useTheme();

  // Fetch tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch reminders
  const { data: reminders = [] } = useQuery({
    queryKey: ["reminders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_date", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get items for selected date
  const getItemsForDate = (date: Date) => {
    const dayTasks = tasks.filter(task => 
      task.due_date && isSameDay(new Date(task.due_date), date)
    );
    
    const dayReminders = reminders.filter(reminder => 
      reminder.due_date && isSameDay(new Date(reminder.due_date), date)
    );

    return [...dayTasks, ...dayReminders];
  };

  const selectedDateItems = getItemsForDate(selectedDate);

  // Get dates that have items
  const getDatesWithItems = () => {
    const dates: Date[] = [];
    
    tasks.forEach(task => {
      if (task.due_date) {
        dates.push(new Date(task.due_date));
      }
    });
    
    reminders.forEach(reminder => {
      if (reminder.due_date) {
        dates.push(new Date(reminder.due_date));
      }
    });
    
    return dates;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("calendar", language)}</h1>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => navigate("/task/create")}
            className="flex items-center gap-1"
          >
            <Plus size={16} />
            {t("task", language)}
          </Button>
          <Button 
            size="sm" 
            onClick={() => navigate("/reminder/create")}
            className="flex items-center gap-1"
          >
            <Plus size={16} />
            {t("reminder", language)}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Calendar */}
        <Card>
          <CardHeader>
            <CardTitle>{t("calendar", language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              modifiers={{
                hasItems: getDatesWithItems(),
              }}
              modifiersStyles={{
                hasItems: {
                  backgroundColor: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  borderRadius: "50%",
                },
              }}
              className="rounded-md border"
            />
          </CardContent>
        </Card>

        {/* Items for selected date */}
        <Card>
          <CardHeader>
            <CardTitle>
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDateItems.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {t("noItemsForDate", language)}
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateItems.map((item) => {
                  const isTask = 'priority' in item;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg cursor-pointer hover:bg-secondary/30 transition-colors"
                      onClick={() => {
                        if (isTask) {
                          navigate(`/tasks/${item.id}`);
                        } else {
                          navigate(`/reminder/${item.id}/edit`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {isTask ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Bell className="h-5 w-5 text-green-600" />
                        )}
                        <div>
                          <h4 className="font-medium">{item.title}</h4>
                          {item.due_date && (
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(item.due_date), "h:mm a")}
                            </p>
                          )}
                        </div>
                      </div>
                      {isTask && (
                        <Badge variant={
                          item.priority === 'high' ? 'destructive' : 
                          item.priority === 'medium' ? 'default' : 
                          'secondary'
                        }>
                          {item.priority}
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
