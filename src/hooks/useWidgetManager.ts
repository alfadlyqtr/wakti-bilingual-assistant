
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TranslationKey } from "@/utils/translationTypes";
import { getUserPreferences, getWidgetOrder, saveWidgetOrder } from "@/utils/widgetPreferences";
import { toast } from "sonner";
import React from "react";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

export const useWidgetManager = (language: 'en' | 'ar', isLoading: boolean, tasks: any[], legacyEvents: any[], reminders: any[]) => {
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const widgetVisibility = getUserPreferences();
    
    // Import components dynamically to avoid circular dependencies
    import("@/components/dashboard/widgets").then(({ TasksWidget, RemindersWidget, CalendarWidget, EventsWidget }) => {
      import("@/components/dashboard/QuoteWidget").then(({ QuoteWidget }) => {
        const defaultWidgets = {
          tasks: {
            id: "tasks",
            title: "tasks" as TranslationKey,
            visible: widgetVisibility.tasks,
            component: React.createElement(TasksWidget, { isLoading, tasks, language }),
          },
          calendar: {
            id: "calendar",
            title: "calendar" as TranslationKey,
            visible: widgetVisibility.calendar !== false, // Default to true if not set
            component: React.createElement(CalendarWidget, { isLoading, events: [], tasks, language }),
          },
          events: {
            id: "events",
            title: "events" as TranslationKey,
            visible: widgetVisibility.events !== false, // Default to true if not set
            component: React.createElement(EventsWidget, { isLoading, events: [], language }),
          },
          reminders: {
            id: "reminders",
            title: "reminders" as TranslationKey,
            visible: widgetVisibility.reminders,
            component: React.createElement(RemindersWidget, { isLoading, reminders, language }),
          },
          quote: {
            id: "quote",
            title: "dailyQuote" as TranslationKey,
            visible: widgetVisibility.dailyQuote,
            component: React.createElement(QuoteWidget)
          },
        };

        // Get saved order and arrange widgets accordingly
        const savedOrder = getWidgetOrder();
        const orderedWidgets = savedOrder.map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets]).filter(Boolean);
        
        console.log('Dashboard widgets configured with new my_tasks system:', orderedWidgets.map(w => w.id));
        setWidgets(orderedWidgets);
      });
    });
  }, [language, navigate, isLoading, tasks, legacyEvents, reminders]);
  
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update the widgets state
    setWidgets(items);
    
    // Save the new order to localStorage
    const newOrder = items.map(widget => widget.id);
    saveWidgetOrder(newOrder);
    
    toast.success(language === 'ar' ? "تم إعادة ترتيب الأداة وحفظها" : "Widget rearranged and saved");
  };
  
  return { widgets, handleDragEnd };
};
