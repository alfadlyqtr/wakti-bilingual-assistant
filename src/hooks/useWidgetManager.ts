
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TranslationKey } from "@/utils/translationTypes";
import { getWidgetOrder } from "@/utils/widgetPreferences";
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
  const navigate = useNavigate();

  useEffect(() => {
    // Try to load remotely or fallback to localStorage
    const loadWidgetPrefsAndInit = async () => {
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

      const savedOrder = getWidgetOrder();
      const orderedWidgets = savedOrder
        .map((id: string) => defaultWidgets[id as keyof typeof defaultWidgets])
        .filter(Boolean);

      setWidgets(orderedWidgets);
    };

    loadWidgetPrefsAndInit();
  }, [language, navigate, isLoading, legacyEvents]);

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);
    const { saveWidgetOrder } = require("@/utils/widgetPreferences");
    const newOrder = items.map((widget) => widget.id);
    saveWidgetOrder(newOrder);

    toast.success(
      language === "ar"
        ? "تم إعادة ترتيب الأداة وحفظها"
        : "Widget rearranged and saved"
    );
  };

  return { widgets, handleDragEnd };
};
