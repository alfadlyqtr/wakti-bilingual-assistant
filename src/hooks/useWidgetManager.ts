
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TranslationKey } from "@/utils/translationTypes";
import { getWidgetOrder, saveWidgetOrder } from "@/utils/widgetPreferences";
import { fetchRemoteWidgetPrefs, getWidgetVisibilityFromProfile } from "@/utils/widgetPreferences";
import { toast } from "sonner";
import React from "react";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

export const useWidgetManager = (
  language: "en" | "ar",
  isLoading: boolean,
  tasks: any[],
  legacyEvents: any[],
  reminders: any[]
) => {
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const [widgetOrder, setWidgetOrder] = useState<string[]>([]);
  const navigate = useNavigate();

  // Load widget order from both local and remote storage
  useEffect(() => {
    const loadWidgetOrder = async () => {
      try {
        // Try to get widget order from Supabase first
        const widgetsDbPrefs = await fetchRemoteWidgetPrefs();
        let savedOrder: string[];
        
        if (widgetsDbPrefs?.widgetOrder) {
          savedOrder = widgetsDbPrefs.widgetOrder;
          console.log('Loaded widget order from remote:', savedOrder);
        } else {
          // Fallback to localStorage
          savedOrder = getWidgetOrder();
          console.log('Loaded widget order from local:', savedOrder);
        }
        
        setWidgetOrder(savedOrder);
      } catch (error) {
        console.error('Error loading widget order:', error);
        // Fallback to localStorage on error
        const localOrder = getWidgetOrder();
        setWidgetOrder(localOrder);
      }
    };

    loadWidgetOrder();
  }, []);

  useEffect(() => {
    const loadWidgetPrefsAndInit = async () => {
      // Wait for widget order to be loaded
      if (widgetOrder.length === 0) return;

      let widgetVisibility: any = undefined;
      try {
        const widgetsDbPrefs = await fetchRemoteWidgetPrefs();
        widgetVisibility = widgetsDbPrefs
          ? getWidgetVisibilityFromProfile(widgetsDbPrefs)
          : null;
      } catch (e) {
        widgetVisibility = null;
      }
      
      // If still null, fallback to localStorage
      if (!widgetVisibility) {
        const { getUserPreferences } = await import("@/utils/widgetPreferences");
        widgetVisibility = getUserPreferences();
      }

      // Import components dynamically to avoid circular dependencies
      const { CalendarWidget, TRWidget, Maw3dWidget } = await import(
        "@/components/dashboard/widgets"
      );
      const { QuoteWidget } = await import(
        "@/components/dashboard/QuoteWidget"
      );
      
      const defaultWidgets = {
        calendar: {
          id: "calendar",
          title: "calendar" as TranslationKey,
          visible: widgetVisibility.calendar !== false,
          component: React.createElement(CalendarWidget, {
            isLoading,
            events: legacyEvents,
            language,
          }),
        },
        tr: {
          id: "tr",
          title: "tasksReminders" as TranslationKey,
          visible: widgetVisibility.tr !== false,
          component: React.createElement(TRWidget, { language }),
        },
        maw3d: {
          id: "maw3d",
          title: "maw3dEvents" as TranslationKey,
          visible: widgetVisibility.maw3d !== false,
          component: React.createElement(Maw3dWidget, { language }),
        },
        quote: {
          id: "quote",
          title: "dailyQuote" as TranslationKey,
          visible: widgetVisibility.quote !== false,
          component: React.createElement(QuoteWidget),
        },
      };

      // Apply the saved order
      const orderedWidgets = widgetOrder
        .map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets])
        .filter(Boolean);

      console.log('Setting widgets with order:', widgetOrder);
      console.log('Ordered widgets:', orderedWidgets.map(w => w.id));
      
      setWidgets(orderedWidgets);
    };

    loadWidgetPrefsAndInit();
  }, [language, navigate, isLoading, legacyEvents, widgetOrder]);

  // Enhanced: Persist new widget order and immediately update state
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately
    setWidgets(items);
    
    const newOrder = items.map((widget) => widget.id);
    console.log('New widget order after drag:', newOrder);
    
    // Update the widgetOrder state
    setWidgetOrder(newOrder);
    
    // Save to both local and remote storage
    await saveWidgetOrder(newOrder);

    toast.success(
      language === "ar"
        ? "تم إعادة ترتيب الأداة وحفظها"
        : "Widget rearranged and saved"
    );
  };

  return { widgets, handleDragEnd };
};
