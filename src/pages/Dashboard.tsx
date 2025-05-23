import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/providers/ThemeProvider";
import { UserMenu } from "@/components/UserMenu";
import { MobileNav } from "@/components/MobileNav";
import { t } from "@/utils/translations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranslationKey } from "@/utils/translationTypes";
import { useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isSameDay, isToday, isTomorrow } from "date-fns";
import { toast } from "sonner";
import { QuoteWidget } from "@/components/dashboard/QuoteWidget";
import { GripVertical, CalendarIcon, CheckCircle, BellRing, Calendar as CalendarIconFull, Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

export default function Dashboard() {
  const { language, theme } = useTheme();
  const [trialDaysLeft, setTrialDaysLeft] = useState(3);
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  
  // Get user preferences from localStorage
  const getUserPreferences = () => {
    try {
      const storedPreferences = localStorage.getItem('widgetVisibility');
      if (storedPreferences) {
        return JSON.parse(storedPreferences);
      }
    } catch (error) {
      console.error('Error loading widget preferences:', error);
    }
    
    // Default preferences if nothing is stored
    return {
      tasks: true,
      calendar: true,
      reminders: true,
      dailyQuote: true,
      events: true,
    };
  };
  
  const widgetVisibility = getUserPreferences();
  
  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Fetch tasks
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(3);
          
        if (!tasksError) {
          setTasks(tasksData || []);
        } else {
          console.error('Error fetching tasks:', tasksError);
          setTasks([]);
        }
        
        // Fetch events
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('start_time', { ascending: true })
          .limit(2);
          
        if (!eventsError) {
          setEvents(eventsData || []);
        } else {
          console.error('Error fetching events:', eventsError);
          setEvents([]);
        }
        
        // Fetch reminders
        const { data: remindersData, error: remindersError } = await supabase
          .from('reminders')
          .select('*')
          .order('due_date', { ascending: true })
          .limit(2);
          
        if (!remindersError) {
          setReminders(remindersData || []);
        } else {
          console.error('Error fetching reminders:', remindersError);
          setReminders([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Initialize widgets
  useEffect(() => {
    setWidgets([
      {
        id: "tasks",
        title: "tasks" as TranslationKey,
        visible: widgetVisibility.tasks,
        component: (
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
        ),
      },
      {
        id: "calendar",
        title: "calendar" as TranslationKey,
        visible: widgetVisibility.calendar,
        component: (
          <div className="p-4">
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">{format(new Date(), "MMMM yyyy")}</h3>
                <div className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded-full">
                  {t("today", language)}
                </div>
              </div>
              
              {/* Calendar days of week header */}
              <div className="grid grid-cols-7 gap-1 mb-1 text-xs text-center">
                <div>S</div>
                <div>M</div>
                <div>T</div>
                <div>W</div>
                <div>T</div>
                <div>F</div>
                <div>S</div>
              </div>
              
              {/* Today and tomorrow calendar cells */}
              <div className="flex gap-1">
                {/* Today */}
                <div className="flex-1 bg-primary text-primary-foreground p-2 rounded-md">
                  <div className="font-bold text-center">{format(new Date(), "d")}</div>
                  <div className="text-xs text-center">{t("today", language)}</div>
                  <div className="mt-1 text-xs">
                    {isLoading ? (
                      <Skeleton className="h-3 w-full" />
                    ) : events && events.length > 0 ? (
                      <div className="truncate">{events.length} {events.length === 1 ? t("event", language) : t("events", language)}</div>
                    ) : (
                      <div className="truncate">{t("noEvents", language)}</div>
                    )}
                    {isLoading ? (
                      <Skeleton className="h-3 w-4/5 mt-1" />
                    ) : tasks && tasks.length > 0 ? (
                      <div className="truncate">{tasks.length} {tasks.length === 1 ? t("task", language) : t("tasks", language)}</div>
                    ) : (
                      <div className="truncate">{t("noTasks", language)}</div>
                    )}
                  </div>
                </div>
                
                {/* Tomorrow */}
                <div className="flex-1 bg-secondary/20 p-2 rounded-md">
                  <div className="font-bold text-center">{format(addDays(new Date(), 1), "d")}</div>
                  <div className="text-xs text-center">{t("tomorrow", language)}</div>
                  <div className="mt-1 text-xs">
                    <div className="truncate">{t("nothingScheduled", language)}</div>
                  </div>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('/calendar')}>
              {t("calendar_open", language)}
            </Button>
          </div>
        ),
      },
      {
        id: "events",
        title: "events" as TranslationKey,
        visible: widgetVisibility.events,
        component: (
          <div className="p-4">
            <h3 className="font-medium mb-2">{t("events_today", language)}</h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : events && events.length > 0 ? (
              <div className="space-y-2">
                {events.map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
                    <div>
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-muted-foreground">{event.location || t("noLocation", language)}</div>
                    </div>
                    <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-full">
                      {event.start_time ? format(new Date(event.start_time), "h:mm a") : "--:--"}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/events')}>
                  {t("events_view_all", language)}
                </Button>
              </div>
            ) : (
              <div className="text-center py-3">
                <CalendarIconFull className="mx-auto h-8 w-8 text-muted-foreground opacity-50 mb-2" />
                <p className="text-sm text-muted-foreground">{t("noEventsYet", language)}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/events')}>
                  {t("createEvent", language)}
                </Button>
              </div>
            )}
          </div>
        ),
      },
      {
        id: "reminders",
        title: "reminders" as TranslationKey,
        visible: widgetVisibility.reminders,
        component: (
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
        ),
      },
      {
        id: "quote",
        title: "dailyQuote" as TranslationKey,
        visible: widgetVisibility.dailyQuote,
        component: <QuoteWidget />
      },
    ]);
  }, [language, navigate, widgetVisibility]);

  // Handle drag end
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setWidgets(items);
    toast.success(language === 'ar' ? "تم إعادة ترتيب الأداة" : "Widget rearranged");
  };

  // Toggle drag mode button handler
  const toggleDragMode = () => {
    const newDraggingState = !isDragging;
    setIsDragging(newDraggingState);
    
    if (newDraggingState) {
      toast.info(language === 'ar' ? "تم تفعيل وضع السحب" : "Drag mode activated");
    } else {
      toast.info(language === 'ar' ? "تم إلغاء تفعيل وضع السحب" : "Drag mode deactivated");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28">
      {/* Trial Timer */}
      {trialDaysLeft > 0 && (
        <Card className="mb-4 bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium">
                  {t("freeTrialDays", language)}:
                </p>
                <p className="text-xl font-bold">{trialDaysLeft} {language === 'ar' ? "أيام متبقية" : "days left"}</p>
              </div>
              <Button size="sm">{language === 'ar' ? "ترقية" : "Upgrade"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Widgets */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="widgets">
          {(provided) => (
            <div 
              className="space-y-4"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {/* Drag mode toggle button */}
              <div className="flex justify-end mb-2">
                <Button 
                  size="sm" 
                  variant={isDragging ? "default" : "outline"} 
                  onClick={toggleDragMode}
                  className="flex items-center gap-1"
                >
                  <Hand className="h-3 w-3" />
                  {isDragging 
                    ? (language === 'ar' ? "إيقاف السحب" : "Exit Drag Mode") 
                    : (language === 'ar' ? "تنظيم الأدوات" : "Organize Widgets")
                  }
                </Button>
              </div>
              
              {widgets
                .filter(widget => widget.visible)
                .map((widget, index) => (
                  <Draggable 
                    key={widget.id} 
                    draggableId={widget.id} 
                    index={index}
                    isDragDisabled={false} // Always allow dragging
                  >
                    {(provided, snapshot) => (
                      <Card 
                        className={`shadow-sm relative ${snapshot.isDragging ? 'ring-2 ring-primary' : ''} 
                                   ${isDragging ? 'border-dashed border-primary/70' : ''}`}
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        {/* Drag handle always visible in top-left corner */}
                        <div 
                          className={`absolute top-2 left-2 z-20 p-1 rounded-md 
                                    ${isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted/60'}
                                    hover:bg-primary/80 hover:text-primary-foreground transition-colors 
                                    cursor-grab active:cursor-grabbing`}
                          {...provided.dragHandleProps}
                        >
                          <Hand className="h-4 w-4" />
                        </div>
                        
                        <CardContent className="p-0 pt-8">
                          {widget.component}
                        </CardContent>
                      </Card>
                    )}
                  </Draggable>
                ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
