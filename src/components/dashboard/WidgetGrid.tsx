
import React, { useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { 
  TasksWidget, 
  CalendarWidget, 
  RemindersWidget 
} from './widgets';
import { QuoteWidget } from './QuoteWidget';
import { DragModeToggle } from './DragModeToggle';
import { useWidgetManager } from '@/hooks/useWidgetManager';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface WidgetGridProps {
  dragMode: boolean;
  setDragMode: (enabled: boolean) => void;
}

export default function WidgetGrid({ dragMode, setDragMode }: WidgetGridProps) {
  const { layouts, saveLayouts, widgets, updateWidgetVisibility } = useWidgetManager();

  const availableWidgets = [
    { 
      id: 'tasksWidget', 
      component: <TasksWidget />, 
      title: 'Tasks',
      visible: widgets.tasksWidget
    },
    { 
      id: 'calendarWidget', 
      component: <CalendarWidget />, 
      title: 'Calendar',
      visible: widgets.calendarWidget
    },
    { 
      id: 'remindersWidget', 
      component: <RemindersWidget />, 
      title: 'Reminders',
      visible: widgets.remindersWidget
    },
    { 
      id: 'quoteWidget', 
      component: <QuoteWidget />, 
      title: 'Quote',
      visible: widgets.quoteWidget
    }
  ];

  const visibleWidgets = availableWidgets.filter(widget => widget.visible);

  return (
    <div className="relative">
      <DragModeToggle 
        dragMode={dragMode} 
        setDragMode={setDragMode}
        widgets={widgets}
        updateWidgetVisibility={updateWidgetVisibility}
      />
      
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={(layout, layouts) => saveLayouts(layouts)}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        isDraggable={dragMode}
        isResizable={dragMode}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        rowHeight={60}
      >
        {visibleWidgets.map((widget) => (
          <div key={widget.id} className="widget-container">
            {widget.component}
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
