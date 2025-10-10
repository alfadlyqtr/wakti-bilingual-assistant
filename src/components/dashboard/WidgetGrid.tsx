import React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { TranslationKey } from "@/utils/translationTypes";
import { WidgetDragHandleProvider } from "@/components/dashboard/WidgetDragHandleContext";

type WidgetType = {
  id: string;
  title: TranslationKey;
  component: React.ReactNode;
  visible: boolean;
};

interface WidgetGridProps {
  widgets: WidgetType[];
  isDragging: boolean;
  onDragEnd: (result: any) => void;
}

// Sortable Widget Item Component
const SortableWidget = ({ widget, isDragging }: { widget: WidgetType; isDragging: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
    setActivatorNodeRef,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // During drag mode, prevent native scrolling interference
    touchAction: isDragging ? 'none' as const : 'auto' as const,
  };

  const handleContextValue = {
    registerHandle: setActivatorNodeRef,
    listeners: isDragging ? listeners : {},
    attributes: isDragging ? attributes : {},
    isDragging,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      className={`relative transition-all duration-200 w-[calc(100%-2rem)] mx-auto rounded-3xl overflow-hidden backdrop-blur-xl border border-white/10 bg-background/60 shadow-2xl ${
        isSortableDragging ? 'ring-2 ring-primary shadow-lg scale-102 z-50' : ''
      } ${isDragging ? 'border-dashed border-primary/70' : ''}`}
    >
      {/* Glass reflection overlay */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-25 pointer-events-none" />
      <CardContent className="p-0 w-full relative z-10">
        <WidgetDragHandleProvider value={handleContextValue}>
          {widget.component}
        </WidgetDragHandleProvider>
      </CardContent>
    </Card>
  );
};

// Static (non-draggable) Widget Item Component
const StaticWidget = ({ widget }: { widget: WidgetType }) => {
  return (
    <Card className="relative transition-all duration-200 w-[calc(100%-2rem)] mx-auto rounded-3xl overflow-hidden backdrop-blur-xl border border-white/10 bg-background/60 shadow-2xl">
      {/* Glass reflection overlay */}
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-25 pointer-events-none" />
      <CardContent className="p-0 w-full relative z-10">
        {widget.component}
      </CardContent>
    </Card>
  );
};

export const WidgetGrid: React.FC<WidgetGridProps> = ({ widgets, isDragging, onDragEnd }) => {
  // Only show visible widgets
  const visibleWidgets = widgets.filter(widget => widget.visible);

  const sensors = useSensors(
    // Add activation constraint to avoid accidental drags on touch
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  console.log('WidgetGrid: Rendering', visibleWidgets.length, 'visible widgets');

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = visibleWidgets.findIndex(widget => widget.id === active.id);
      const newIndex = visibleWidgets.findIndex(widget => widget.id === over.id);
      
      // Convert to react-beautiful-dnd format for compatibility
      const result = {
        source: { index: oldIndex },
        destination: { index: newIndex },
        draggableId: active.id,
      };
      
      onDragEnd(result);
    }
  };

  // When not in drag mode, render a simple static list without DnD contexts
  if (!isDragging) {
    return (
      <div className="space-y-4 w-full">
        {visibleWidgets.map((widget) => (
          <StaticWidget key={widget.id} widget={widget} />
        ))}
      </div>
    );
  }

  // Drag mode: enable DnD contexts and sortable items
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4 w-full">
          {visibleWidgets.map((widget) => (
            <SortableWidget key={widget.id} widget={widget} isDragging={isDragging} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
