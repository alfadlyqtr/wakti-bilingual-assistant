
import React from "react";
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
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="widgets">
        {(provided) => (
          <div 
            className="space-y-4"
            {...provided.droppableProps}
            ref={provided.innerRef}
          >
            {widgets
              .filter(widget => widget.visible)
              .map((widget, index) => (
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
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};
