
import { useState, useEffect } from "react";
import { TranslationKey } from "@/utils/translationTypes";
import { toast } from "sonner";
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

  // Initialize widgets immediately - simplified, no async loading
  useEffect(() => {
    const initializeWidgets = async () => {
      // Get current order
      const currentOrder = getWidgetOrder();
      
      // Import components
      const { CalendarWidget, TRWidget, Maw3dWidget } = await import(
        "@/components/dashboard/widgets"
      );
      const { QuoteWidget } = await import(
        "@/components/dashboard/QuoteWidget"
      );

      // Define simplified widgets - all visible by default
      const defaultWidgets = {
        calendar: {
          id: "calendar",
          title: "calendar" as TranslationKey,
          visible: true,
          component: React.createElement(CalendarWidget, {
            language,
          }),
        },
        tr: {
          id: "tr",
          title: "tasksReminders" as TranslationKey,
          visible: true,
          component: React.createElement(TRWidget, { language }),
        },
        maw3d: {
          id: "maw3d",
          title: "maw3dEvents" as TranslationKey,
          visible: true,
          component: React.createElement(Maw3dWidget, { language }),
        },
        quote: {
          id: "quote",
          title: "dailyQuote" as TranslationKey,
          visible: true,
          component: React.createElement(QuoteWidget),
        },
      };

      // Apply saved order
      const orderedWidgets = currentOrder
        .map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets])
        .filter(Boolean);

      console.log('Simplified widgets initialized with order:', currentOrder);
      setWidgets(orderedWidgets);
    };

    initializeWidgets();
  }, [language]);

  // Simple drag handler - just reorder and save
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update state immediately
    setWidgets(items);
    
    // Save new order
    const newOrder = items.map((widget) => widget.id);
    saveWidgetOrder(newOrder);

    console.log('Widgets reordered:', newOrder);
    
    toast.success(
      language === "ar"
        ? "تم إعادة ترتيب الأداة وحفظها"
        : "Widget rearranged and saved"
    );
  };

  return { widgets, handleDragEnd };
};
