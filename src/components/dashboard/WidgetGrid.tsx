
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
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card 
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`shadow-sm relative transition-all duration-200 ${
        isSortableDragging ? 'ring-2 ring-primary shadow-lg scale-102 z-50' : ''
      } ${isDragging ? 'border-dashed border-primary/70' : ''}`}
    >
      <CardContent className="p-0">
        {widget.component}
      </CardContent>
    </Card>
  );
};

export const WidgetGrid: React.FC<WidgetGridProps> = ({ widgets, isDragging, onDragEnd }) => {
  // Only show visible widgets
  const visibleWidgets = widgets.filter(widget => widget.visible);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={visibleWidgets.map(w => w.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {visibleWidgets.map((widget) => (
            <SortableWidget key={widget.id} widget={widget} isDragging={isDragging} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
