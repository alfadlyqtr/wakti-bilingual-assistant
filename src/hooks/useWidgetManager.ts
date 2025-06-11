
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
    console.log('Widget visibility preferences loaded:', widgetVisibility);
    
    // Import components dynamically to avoid circular dependencies
    import("@/components/dashboard/widgets").then(({ CalendarWidget, TRWidget, Maw3dWidget }) => {
      import("@/components/dashboard/QuoteWidget").then(({ QuoteWidget }) => {
        const defaultWidgets = {
          calendar: {
            id: "calendar",
            title: "calendar" as TranslationKey,
            visible: widgetVisibility.calendar !== false, // Default to true if not set
            component: React.createElement(CalendarWidget, { isLoading, events: legacyEvents, language }),
          },
          tr: {
            id: "tr",
            title: "tasksReminders" as TranslationKey,
            visible: widgetVisibility.tr !== false, // Default to true if not set
            component: React.createElement(TRWidget, { language }),
          },
          maw3d: {
            id: "maw3d",
            title: "maw3dEvents" as TranslationKey,
            visible: widgetVisibility.maw3d !== false, // Default to true if not set
            component: React.createElement(Maw3dWidget, { language }),
          },
          quote: {
            id: "quote",
            title: "dailyQuote" as TranslationKey,
            visible: widgetVisibility.dailyQuote !== false, // Fixed: now consistent with other widgets
            component: React.createElement(QuoteWidget)
          },
        };

        console.log('Widget objects created:', Object.entries(defaultWidgets).map(([key, widget]) => ({
          id: key,
          visible: widget.visible
        })));

        // Get saved order and arrange widgets accordingly
        const savedOrder = getWidgetOrder();
        console.log('Saved widget order:', savedOrder);
        
        const orderedWidgets = savedOrder.map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets]).filter(Boolean);
        
        console.log('Final ordered widgets:', orderedWidgets.map(w => ({ id: w.id, visible: w.visible })));
        console.log('Visible widgets count:', orderedWidgets.filter(w => w.visible).length);
        
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
