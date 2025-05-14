
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
import { MobileHeader } from "@/components/MobileHeader";
import { Calendar } from "@/components/ui/calendar";
import { format, addDays, isSameDay, isToday, isTomorrow } from "date-fns";

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
  
  // Initialize widgets
  useEffect(() => {
    setWidgets([
      {
        id: "tasks",
        title: "tasks" as TranslationKey,
        visible: true,
        component: (
          <div className="space-y-2">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-yellow-400 mr-2"></div>
              <span className="text-sm">Complete project proposal</span>
            </div>
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-red-500 mr-2"></div>
              <span className="text-sm">Call with client</span>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/tasks')}>
              {t("tasks_view_all", language)}
            </Button>
          </div>
        ),
      },
      {
        id: "calendar",
        title: "calendar" as TranslationKey,
        visible: true,
        component: (
          <div>
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
                    <div className="truncate">2 {t("events", language)}</div>
                    <div className="truncate">1 {t("task", language)}</div>
                  </div>
                </div>
                
                {/* Tomorrow */}
                <div className="flex-1 bg-secondary/20 p-2 rounded-md">
                  <div className="font-bold text-center">{format(addDays(new Date(), 1), "d")}</div>
                  <div className="text-xs text-center">{t("tomorrow", language)}</div>
                  <div className="mt-1 text-xs">
                    <div className="truncate">1 {t("event", language)}</div>
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
        visible: true,
        component: (
          <div className="text-sm">
            <h3 className="font-medium mb-2">{t("events_today", language)}</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
                <div>
                  <div className="font-medium">Team Meeting</div>
                  <div className="text-xs text-muted-foreground">Online</div>
                </div>
                <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-full">3:00 PM</div>
              </div>
              <div className="flex items-center justify-between p-2 bg-secondary/20 rounded-md">
                <div>
                  <div className="font-medium">Project Review</div>
                  <div className="text-xs text-muted-foreground">Conference Room</div>
                </div>
                <div className="text-xs font-medium bg-secondary px-2 py-1 rounded-full">5:30 PM</div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/events')}>
              {t("events_view_all", language)}
            </Button>
          </div>
        ),
      },
      {
        id: "reminders",
        title: "reminders" as TranslationKey,
        visible: true,
        component: (
          <div className="text-sm">
            <div className="flex justify-between items-center mb-1">
              <div>Submit weekly report</div>
              <div className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">Tomorrow</div>
            </div>
            <div className="flex justify-between items-center">
              <div>Team lunch</div>
              <div className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">Friday</div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => navigate('/tasks')}>
              {t("reminders_view_all", language)}
            </Button>
          </div>
        ),
      },
      {
        id: "quote",
        title: "dailyQuote" as TranslationKey,
        visible: true,
        component: (
          <div className="text-sm">
            <p className="text-sm italic">
              "The secret of getting ahead is getting started."
            </p>
            <p className="text-xs text-muted-foreground mt-1">- Mark Twain</p>
          </div>
        ),
      },
    ]);
  }, [language, navigate]);

  // Handle drag end
  const handleDragEnd = (result: any) => {
    setIsDragging(false);
    
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setWidgets(items);
  };

  // Handle long press
  const handleLongPress = () => {
    setIsDragging(true);
  };

  return (
    <div className="mobile-container">
      <MobileHeader title={t("dashboard", language)} />

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
                  <p className="text-xl font-bold">{trialDaysLeft} days left</p>
                </div>
                <Button size="sm">Upgrade</Button>
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
                {widgets
                  .filter(widget => widget.visible)
                  .map((widget, index) => (
                    <Draggable 
                      key={widget.id} 
                      draggableId={widget.id} 
                      index={index}
                      isDragDisabled={!isDragging}
                    >
                      {(provided) => (
                        <Card 
                          className="shadow-sm relative"
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          onTouchStart={() => {
                            let timer = setTimeout(() => {
                              handleLongPress();
                            }, 500);
                            
                            const clearTimer = () => {
                              clearTimeout(timer);
                            };
                            
                            document.addEventListener('touchend', clearTimer, { once: true });
                          }}
                        >
                          {isDragging && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10 rounded-md">
                              <div className="h-2 w-12 bg-muted-foreground rounded-full" />
                            </div>
                          )}
                          <CardHeader className="p-3 pb-1">
                            <CardTitle className="text-lg">
                              {t(widget.title, language)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">{widget.component}</CardContent>
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

      <MobileNav />
    </div>
  );
}
