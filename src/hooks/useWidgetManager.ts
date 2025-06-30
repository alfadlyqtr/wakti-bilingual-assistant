
import { useState, useEffect } from "react";
import { TranslationKey } from "@/utils/translationTypes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const [widgetSettings, setWidgetSettings] = useState({
    showCalendarWidget: true,
    showTasksWidget: true,
    showTRWidget: true,
    showMaw3dWidget: true,
    showQuoteWidget: true,
  });

  // Load widget settings from database
  const loadWidgetSettings = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .single();

      if (profile?.settings?.widgets) {
        const dbSettings = profile.settings.widgets;
        setWidgetSettings({
          showCalendarWidget: dbSettings.showCalendarWidget !== false,
          showTasksWidget: dbSettings.showTasksWidget !== false,
          showTRWidget: dbSettings.showTRWidget !== false,
          showMaw3dWidget: dbSettings.showMaw3dWidget !== false,
          showQuoteWidget: dbSettings.showQuoteWidget !== false,
        });
      }
    } catch (error) {
      console.error('Error loading widget settings:', error);
    }
  };

  // Initialize widgets with proper visibility
  useEffect(() => {
    const initializeWidgets = async () => {
      if (!user) return;

      // Load settings first
      await loadWidgetSettings();

      // Get current order
      const currentOrder = getWidgetOrder();
      
      // Import components
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
          }),
        },
        tr: {
          id: "tr",
          title: "tasksReminders" as TranslationKey,
          visible: widgetSettings.showTRWidget,
          component: React.createElement(TRWidget, { language }),
        },
        maw3d: {
          id: "maw3d",
          title: "maw3dEvents" as TranslationKey,
          visible: widgetSettings.showMaw3dWidget,
          component: React.createElement(Maw3dWidget, { language }),
        },
        quote: {
          id: "quote",
          title: "dailyQuote" as TranslationKey,
          visible: widgetSettings.showQuoteWidget,
          component: React.createElement(QuoteWidget),
        },
      };

      // Apply saved order
      const orderedWidgets = currentOrder
        .map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets])
        .filter(Boolean);

      console.log('Widgets initialized with settings:', widgetSettings);
      setWidgets(orderedWidgets);
    };

    initializeWidgets();
  }, [language, user, widgetSettings.showCalendarWidget, widgetSettings.showTasksWidget, widgetSettings.showTRWidget, widgetSettings.showMaw3dWidget, widgetSettings.showQuoteWidget]);

  // Load widget settings on mount and user change
  useEffect(() => {
    if (user) {
      loadWidgetSettings();
    }
  }, [user]);

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
