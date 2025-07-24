
import { useState, useEffect } from "react";
import { TranslationKey } from "@/utils/translationTypes";
import { toast } from "sonner";
import { useBatchedUserData } from "@/hooks/useBatchedUserData";
import React from "react";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

export const useWidgetManager = (
  language: "en" | "ar"
) => {
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  
  // Use batched user data instead of separate API calls
  const { widgetSettings, loading: userDataLoading } = useBatchedUserData();

  // Initialize widgets with proper visibility and memoization
  useEffect(() => {
    const initializeWidgets = async () => {
      if (userDataLoading) return;

      // Get current order
      const currentOrder = getWidgetOrder();
      
      // Import components - using dynamic imports for better performance
      const { CalendarWidget, TRWidget, Maw3dWidget } = await import(
        "@/components/dashboard/widgets"
      );
      const { QuoteWidget } = await import(
        "@/components/dashboard/QuoteWidget"
      );

      // Define widgets with proper visibility from settings
      const defaultWidgets = {
        calendar: {
          id: "calendar",
          title: "calendar" as TranslationKey,
          visible: widgetSettings.showCalendarWidget,
          component: React.createElement(CalendarWidget, {
            language,
            key: `calendar-${language}` // Add key for proper re-rendering
          }),
        },
        tr: {
          id: "tr",
          title: "tasksReminders" as TranslationKey,
          visible: widgetSettings.showTRWidget,
          component: React.createElement(TRWidget, { 
            language,
            key: `tr-${language}` // Add key for proper re-rendering
          }),
        },
        maw3d: {
          id: "maw3d",
          title: "maw3dEvents" as TranslationKey,
          visible: widgetSettings.showMaw3dWidget,
          component: React.createElement(Maw3dWidget, { 
            language,
            key: `maw3d-${language}` // Add key for proper re-rendering
          }),
        },
        quote: {
          id: "quote",
          title: "dailyQuote" as TranslationKey,
          visible: widgetSettings.showQuoteWidget,
          component: React.createElement(QuoteWidget, {
            key: `quote-${language}` // Add key for proper re-rendering
          }),
        },
      };

      // Apply saved order
      const orderedWidgets = currentOrder
        .map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets])
        .filter(Boolean);

      console.log('✅ Widgets initialized with batched settings:', widgetSettings);
      setWidgets(orderedWidgets);
    };

    initializeWidgets();
  }, [language, widgetSettings, userDataLoading]);

  // Simple widget order management - localStorage only
  const getWidgetOrder = () => {
    try {
      const stored = localStorage.getItem('widgetOrder');
      return stored ? JSON.parse(stored) : ['calendar', 'tr', 'maw3d', 'quote'];
    } catch {
      return ['calendar', 'tr', 'maw3d', 'quote'];
    }
  };

  const saveWidgetOrder = (order: string[]) => {
    try {
      localStorage.setItem('widgetOrder', JSON.stringify(order));
      console.log('Widget order saved:', order);
    } catch (error) {
      console.error('Error saving widget order:', error);
    }
  };

  // Optimized drag handler with debouncing to prevent excessive calls
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update state immediately for instant feedback
    setWidgets(items);
    
    // Debounced save to prevent excessive localStorage writes
    const saveTimeout = setTimeout(() => {
      const newOrder = items.map((widget) => widget.id);
      saveWidgetOrder(newOrder);
      console.log('Widgets reordered:', newOrder);
      
      toast.success(
        language === "ar"
          ? "تم إعادة ترتيب الأداة وحفظها"
          : "Widget rearranged and saved"
      );
    }, 300);

    // Cleanup timeout on unmount
    return () => clearTimeout(saveTimeout);
  };

  return { widgets, handleDragEnd };
};
