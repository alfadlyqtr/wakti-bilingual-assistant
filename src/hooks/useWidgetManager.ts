
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TranslationKey } from "@/utils/translationTypes";
import { getUserPreferences, getWidgetOrder, saveWidgetOrder } from "@/utils/widgetPreferences";
import { TasksWidget, CalendarWidget, EventsWidget, RemindersWidget } from "@/components/dashboard/widgets";
import { QuoteWidget } from "@/components/dashboard/QuoteWidget";
import { toast } from "sonner";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

export const useWidgetManager = (language: 'en' | 'ar', isLoading: boolean, tasks: any[], events: any[], reminders: any[]) => {
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const navigate = useNavigate();
  
  useEffect(() => {
    const widgetVisibility = getUserPreferences();
    
    const defaultWidgets = {
      tasks: {
        id: "tasks",
        title: "tasks" as TranslationKey,
        visible: widgetVisibility.tasks,
        component: <TasksWidget isLoading={isLoading} tasks={tasks} language={language} />,
      },
      calendar: {
        id: "calendar",
        title: "calendar" as TranslationKey,
        visible: widgetVisibility.calendar,
        component: <CalendarWidget isLoading={isLoading} events={events} tasks={tasks} language={language} />,
      },
      events: {
        id: "events",
        title: "events" as TranslationKey,
        visible: widgetVisibility.events,
        component: <EventsWidget isLoading={isLoading} events={events} language={language} />,
      },
      reminders: {
        id: "reminders",
        title: "reminders" as TranslationKey,
        visible: widgetVisibility.reminders,
        component: <RemindersWidget isLoading={isLoading} reminders={reminders} language={language} />,
      },
      quote: {
        id: "quote",
        title: "dailyQuote" as TranslationKey,
        visible: widgetVisibility.dailyQuote,
        component: <QuoteWidget />
      },
    };

    // Get saved order and arrange widgets accordingly
    const savedOrder = getWidgetOrder();
    const orderedWidgets = savedOrder.map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets]).filter(Boolean);
    
    setWidgets(orderedWidgets);
  }, [language, navigate, isLoading, tasks, events, reminders]);
  
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
