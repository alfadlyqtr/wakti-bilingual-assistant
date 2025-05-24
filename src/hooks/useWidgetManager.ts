
import { useState, useEffect } from 'react';
import { Layout, Layouts } from 'react-grid-layout';

interface WidgetSettings {
  tasksWidget: boolean;
  calendarWidget: boolean;
  remindersWidget: boolean;
  quoteWidget: boolean;
}

const defaultLayouts: Layouts = {
  lg: [
    { i: 'tasksWidget', x: 0, y: 0, w: 6, h: 4 },
    { i: 'calendarWidget', x: 6, y: 0, w: 6, h: 4 },
    { i: 'remindersWidget', x: 0, y: 4, w: 6, h: 4 },
    { i: 'quoteWidget', x: 6, y: 4, w: 6, h: 2 }
  ],
  md: [
    { i: 'tasksWidget', x: 0, y: 0, w: 5, h: 4 },
    { i: 'calendarWidget', x: 5, y: 0, w: 5, h: 4 },
    { i: 'remindersWidget', x: 0, y: 4, w: 5, h: 4 },
    { i: 'quoteWidget', x: 5, y: 4, w: 5, h: 2 }
  ],
  sm: [
    { i: 'tasksWidget', x: 0, y: 0, w: 6, h: 4 },
    { i: 'calendarWidget', x: 0, y: 4, w: 6, h: 4 },
    { i: 'remindersWidget', x: 0, y: 8, w: 6, h: 4 },
    { i: 'quoteWidget', x: 0, y: 12, w: 6, h: 2 }
  ],
  xs: [
    { i: 'tasksWidget', x: 0, y: 0, w: 4, h: 4 },
    { i: 'calendarWidget', x: 0, y: 4, w: 4, h: 4 },
    { i: 'remindersWidget', x: 0, y: 8, w: 4, h: 4 },
    { i: 'quoteWidget', x: 0, y: 12, w: 4, h: 2 }
  ],
  xxs: [
    { i: 'tasksWidget', x: 0, y: 0, w: 2, h: 4 },
    { i: 'calendarWidget', x: 0, y: 4, w: 2, h: 4 },
    { i: 'remindersWidget', x: 0, y: 8, w: 2, h: 4 },
    { i: 'quoteWidget', x: 0, y: 12, w: 2, h: 2 }
  ]
};

const defaultWidgets: WidgetSettings = {
  tasksWidget: true,
  calendarWidget: true,
  remindersWidget: true,
  quoteWidget: true
};

export const useWidgetManager = () => {
  const [layouts, setLayouts] = useState<Layouts>(defaultLayouts);
  const [widgets, setWidgets] = useState<WidgetSettings>(defaultWidgets);

  // Load saved layouts and widget settings on mount
  useEffect(() => {
    const savedLayouts = localStorage.getItem('dashboard-layouts');
    const savedWidgets = localStorage.getItem('dashboard-widgets');
    
    if (savedLayouts) {
      try {
        setLayouts(JSON.parse(savedLayouts));
      } catch (error) {
        console.error('Error parsing saved layouts:', error);
      }
    }
    
    if (savedWidgets) {
      try {
        setWidgets(JSON.parse(savedWidgets));
      } catch (error) {
        console.error('Error parsing saved widgets:', error);
      }
    }
  }, []);

  const saveLayouts = (newLayouts: Layouts) => {
    setLayouts(newLayouts);
    localStorage.setItem('dashboard-layouts', JSON.stringify(newLayouts));
  };

  const updateWidgetVisibility = (widgetId: keyof WidgetSettings, visible: boolean) => {
    const newWidgets = { ...widgets, [widgetId]: visible };
    setWidgets(newWidgets);
    localStorage.setItem('dashboard-widgets', JSON.stringify(newWidgets));
  };

  const resetToDefaults = () => {
    setLayouts(defaultLayouts);
    setWidgets(defaultWidgets);
    localStorage.removeItem('dashboard-layouts');
    localStorage.removeItem('dashboard-widgets');
  };

  return {
    layouts,
    widgets,
    saveLayouts,
    updateWidgetVisibility,
    resetToDefaults
  };
};
