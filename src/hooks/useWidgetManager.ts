
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
    import("@/components/dashboard/widgets").then(({ CalendarWidget, EventsWidget }) => {
      import("@/components/dashboard/QuoteWidget").then(({ QuoteWidget }) => {
        const defaultWidgets = {
          calendar: {
            id: "calendar",
            title: "calendar" as TranslationKey,
            visible: widgetVisibility.calendar !== false, // Default to true if not set
            component: React.createElement(CalendarWidget, { isLoading, events: legacyEvents, language }),
          },
          events: {
            id: "events",
            title: "events" as TranslationKey,
            visible: widgetVisibility.events !== false, // Default to true if not set
            component: React.createElement(EventsWidget, { isLoading, events: legacyEvents, language }),
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
        
        console.log('Dashboard widgets configured:', orderedWidgets.map(w => w.id));
        setWidgets(orderedWidgets);
      });
    });
  }, [language, navigate, isLoading, legacyEvents]);
  
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
