// @ts-nocheck
import { useState, useEffect } from "react";
import { TranslationKey } from "@/utils/translationTypes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import React from "react";

const DEFAULT_WIDGET_ORDER = ["nav", "calendar", "journal", "tr", "whoop", "maw3d", "quote"];

const mergeOrder = (order: string[]): string[] => {
  // Keep user's order for widgets they already have
  const filtered = order.filter(
    (id, index) => DEFAULT_WIDGET_ORDER.includes(id) && order.indexOf(id) === index
  );
  // Find new widgets not in user's order
  const missing = DEFAULT_WIDGET_ORDER.filter((id) => !filtered.includes(id));
  
  // Insert missing widgets at their default positions
  const result = [...filtered];
  for (const id of missing) {
    const defaultIndex = DEFAULT_WIDGET_ORDER.indexOf(id);
    // Insert at the default position, clamped to current length
    const insertAt = Math.min(defaultIndex, result.length);
    result.splice(insertAt, 0, id);
  }
  return result;
};

const sanitizeOrderInput = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const typed = (value as unknown[]).filter((id): id is string => typeof id === "string");
  if (typed.length === 0) return null;
  return mergeOrder(typed);
};

const getLocalOrder = (): string[] => {
  try {
    const stored = localStorage.getItem("widgetOrder");
    if (stored) {
      const parsed = JSON.parse(stored);
      const sanitized = sanitizeOrderInput(parsed);
      if (sanitized) {
        return sanitized;
      }
    }
  } catch (error) {
    console.error("Error reading widget order from localStorage:", error);
  }
  return [...DEFAULT_WIDGET_ORDER];
};

const saveLocalOrder = (order: string[]) => {
  try {
    localStorage.setItem("widgetOrder", JSON.stringify(order));
  } catch (error) {
    console.error("Error saving widget order to localStorage:", error);
  }
};

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

type WidgetVisibilitySettings = {
  showNavWidget: boolean;
  showCalendarWidget: boolean;
  showTRWidget: boolean;
  showMaw3dWidget: boolean;
  showQuoteWidget: boolean;
  showWhoopWidget: boolean;
  showJournalWidget: boolean;
};

export const useWidgetManager = (language: "en" | "ar") => {
  const { user } = useAuth();
  const [widgets, setWidgets] = useState<WidgetType[]>([]);
  const [widgetSettings, setWidgetSettings] = useState<WidgetVisibilitySettings>({
    showNavWidget: true,
    showCalendarWidget: true,
    showTRWidget: true,
    showMaw3dWidget: true,
    showQuoteWidget: true,
    showWhoopWidget: true,
    showJournalWidget: true,
  });
  const [profileSettings, setProfileSettings] = useState<Record<string, any> | null>(null);
  const [currentOrder, setCurrentOrder] = useState<string[]>(() => getLocalOrder());

  useEffect(() => {
    if (!user) {
      setProfileSettings(null);
      const fallback = getLocalOrder();
      setCurrentOrder(fallback);
      return;
    }

    let active = true;

    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("settings")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        if (!active) return;

        const settingsPayload = data?.settings ?? {};
        setProfileSettings(settingsPayload);

        const widgetPrefs = settingsPayload.widgets ?? {};
        setWidgetSettings({
          showNavWidget: widgetPrefs.showNavWidget !== false,
          showCalendarWidget: widgetPrefs.showCalendarWidget !== false,
          showTRWidget: widgetPrefs.showTRWidget !== false,
          showMaw3dWidget: widgetPrefs.showMaw3dWidget !== false,
          showQuoteWidget: widgetPrefs.showQuoteWidget !== false,
          showWhoopWidget: widgetPrefs.showWhoopWidget !== false,
          showJournalWidget: widgetPrefs.showJournalWidget !== false,
        });

        const orderFromDb = sanitizeOrderInput(widgetPrefs.order);
        if (orderFromDb) {
          saveLocalOrder(orderFromDb);
          setCurrentOrder(orderFromDb);
        } else {
          const fallback = getLocalOrder();
          setCurrentOrder(fallback);
        }
      } catch (error) {
        console.error("Error loading widget settings:", error);
        if (!active) return;
        // Ensure default widget settings are applied even on error
        setWidgetSettings({
          showNavWidget: true,
          showCalendarWidget: true,
          showTRWidget: true,
          showMaw3dWidget: true,
          showQuoteWidget: true,
          showWhoopWidget: true,
          showJournalWidget: true,
        });
        const fallback = getLocalOrder();
        setCurrentOrder(fallback);
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, [user]);

  // Live update widget visibility when Settings dispatches the custom event
  useEffect(() => {
    const handleWidgetSettingsChanged = (e: any) => {
      const prefs = (e && e.detail) || {};
      setWidgetSettings({
        showNavWidget: prefs.showNavWidget !== false,
        showCalendarWidget: prefs.showCalendarWidget !== false,
        showTRWidget: prefs.showTRWidget !== false,
        showMaw3dWidget: prefs.showMaw3dWidget !== false,
        showQuoteWidget: prefs.showQuoteWidget !== false,
        showWhoopWidget: prefs.showWhoopWidget !== false,
        showJournalWidget: prefs.showJournalWidget !== false,
      });
    };

    window.addEventListener('widgetSettingsChanged', handleWidgetSettingsChanged as any);
    return () => window.removeEventListener('widgetSettingsChanged', handleWidgetSettingsChanged as any);
  }, []);

  useEffect(() => {
    if (!user) {
      setWidgets([]);
      return;
    }

    let cancelled = false;

    const initializeWidgets = async () => {
      const effectiveOrder = mergeOrder(currentOrder);

      try {
        const {
          CalendarWidget,
          TRWidget,
          Maw3dWidget,
          WhoopWidget,
          JournalWidget,
          NavWidget,
        } = await import("@/components/dashboard/widgets");
        const { QuoteWidget } = await import("@/components/dashboard/QuoteWidget");

        const widgetMap: Record<string, WidgetType> = {
          nav: {
            id: "nav",
            title: "dashboard",
            visible: widgetSettings.showNavWidget,
            component: React.createElement(NavWidget, {
              language,
              key: `nav-${language}`,
            }),
          },
          calendar: {
            id: "calendar",
            title: "calendar",
            visible: widgetSettings.showCalendarWidget,
            component: React.createElement(CalendarWidget, {
              language,
              key: `calendar-${language}`,
            }),
          },
          journal: {
            id: "journal",
            title: "journal",
            visible: widgetSettings.showJournalWidget,
            component: React.createElement(JournalWidget, {
              key: `journal-${language}`,
            }),
          },
          tr: {
            id: "tr",
            title: "tasksReminders",
            visible: widgetSettings.showTRWidget,
            component: React.createElement(TRWidget, {
              language,
              key: `tr-${language}`,
            }),
          },
          whoop: {
            id: "whoop",
            title: "dashboard",
            visible: widgetSettings.showWhoopWidget,
            component: React.createElement(WhoopWidget, {
              key: `whoop-${language}`,
            }),
          },
          maw3d: {
            id: "maw3d",
            title: "maw3dEvents",
            visible: widgetSettings.showMaw3dWidget,
            component: React.createElement(Maw3dWidget, {
              language,
              key: `maw3d-${language}`,
            }),
          },
          quote: {
            id: "quote",
            title: "dailyQuote",
            visible: widgetSettings.showQuoteWidget,
            component: React.createElement(QuoteWidget, {
              key: `quote-${language}`,
            }),
          },
        };

        const orderedWidgets = effectiveOrder
          .map((id) => widgetMap[id])
          .filter((widget): widget is WidgetType => Boolean(widget));

        // Fallback: if all widgets in ordered list are invisible but some toggles are ON,
        // rebuild from widgetMap ensuring visible ones are present
        const anyVisibleFlag = (
          widgetSettings.showNavWidget ||
          widgetSettings.showCalendarWidget ||
          widgetSettings.showTRWidget ||
          widgetSettings.showMaw3dWidget ||
          widgetSettings.showQuoteWidget ||
          widgetSettings.showWhoopWidget ||
          widgetSettings.showJournalWidget
        );
        const anyVisibleInList = orderedWidgets.some(w => w.visible);
        const finalWidgets = (!anyVisibleInList && anyVisibleFlag)
          ? effectiveOrder.map(id => widgetMap[id]).filter(Boolean) as WidgetType[]
          : orderedWidgets;

        if (!cancelled) {
          setWidgets(finalWidgets);
        }
      } catch (error) {
        console.error("Error initializing widgets:", error);
      }
    };

    void initializeWidgets();

    return () => {
      cancelled = true;
    };
  }, [
    language,
    user,
    widgetSettings.showNavWidget,
    widgetSettings.showCalendarWidget,
    widgetSettings.showTRWidget,
    widgetSettings.showMaw3dWidget,
    widgetSettings.showQuoteWidget,
    widgetSettings.showWhoopWidget,
    widgetSettings.showJournalWidget,
    currentOrder,
  ]);

  const saveWidgetOrderToSupabase = async (order: string[]) => {
    if (!user) return;

    try {
      const baseSettings =
        profileSettings && typeof profileSettings === "object" ? { ...profileSettings } : {};

      const widgetsSettings = {
        ...(baseSettings.widgets || {}),
        order,
      };

      const updatedSettings = {
        ...baseSettings,
        widgets: widgetsSettings,
      };

      const { error } = await supabase
        .from("profiles")
        .update({ settings: updatedSettings })
        .eq("id", user.id);

      if (error) throw error;

      setProfileSettings(updatedSettings);
      console.log("Widget order saved to Supabase:", order);
    } catch (error) {
      console.error("Error saving widget order to Supabase:", error);
      throw error;
    }
  };

  const persistWidgetOrder = async (order: string[]) => {
    saveLocalOrder(order);
    await saveWidgetOrderToSupabase(order);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setWidgets(items);

    const newOrder = mergeOrder(items.map((widget) => widget.id));
    setCurrentOrder(newOrder);

    void persistWidgetOrder(newOrder)
      .then(() => {
        toast.success(language === "ar" ? "?? ??? ????? ???????" : "Widget arrangement saved");
      })
      .catch((error) => {
        console.error("Error persisting widget order:", error);
        toast.error(
          language === "ar" ? "???? ??? ????? ???????" : "Couldn't save widget order"
        );
      });
  };

  return { widgets, handleDragEnd };
};
