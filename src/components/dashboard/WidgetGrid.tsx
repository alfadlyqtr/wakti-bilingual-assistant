
import React, { useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
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

export const WidgetGrid: React.FC<WidgetGridProps> = ({ widgets, isDragging, onDragEnd }) => {
  const visibleWidgets = widgets.filter(widget => widget.visible);

  // Debug logging for WidgetGrid
  useEffect(() => {
    console.log('WidgetGrid: Received widgets:', widgets.length);
    console.log('WidgetGrid: Visible widgets after filter:', visibleWidgets.length);
    console.log('WidgetGrid: Visible widget details:', visibleWidgets.map(w => ({ id: w.id, title: w.title })));
  }, [widgets, visibleWidgets.length]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="widgets">
        {(provided) => (
          <div 
            className="space-y-4"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {visibleWidgets.map((widget, index) => (
              <Draggable 
                key={widget.id} 
                draggableId={widget.id} 
                index={index}
                isDragDisabled={false}
              >
                {(provided, snapshot) => (
                  <Card 
                    className={`shadow-sm relative transition-all duration-200 ${
                      snapshot.isDragging ? 'ring-2 ring-primary shadow-lg scale-102' : ''
                    } ${isDragging ? 'border-dashed border-primary/70' : ''}`}
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                  >
                    <CardContent className="p-0">
                      {widget.component}
                    </CardContent>
                  </Card>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            
            {/* Debug info for development */}
            {process.env.NODE_ENV === 'development' && visibleWidgets.length === 0 && widgets.length > 0 && (
              <div className="p-4 bg-yellow-100 border border-yellow-300 rounded text-sm">
                <div className="font-medium text-yellow-800">Debug: No visible widgets</div>
                <div className="text-yellow-700">
                  Total widgets: {widgets.length}, 
                  All widget visibility: {widgets.map(w => `${w.id}:${w.visible}`).join(', ')}
                </div>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
