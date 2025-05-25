
import React from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import { Card, CardContent } from "@/components/ui/card";
import { Hand } from "lucide-react";
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
                      className={`shadow-sm relative ${snapshot.isDragging ? 'ring-2 ring-primary' : ''} 
                                 ${isDragging ? 'border-dashed border-primary/70' : ''}`}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                    >
                      {/* Drag handle always visible in top-left corner */}
                      <div 
                        className={`absolute top-2 left-2 z-20 p-1 rounded-md 
                                  ${isDragging ? 'bg-primary text-primary-foreground' : 'bg-muted/60'}
                                  hover:bg-primary/80 hover:text-primary-foreground transition-colors 
                                  cursor-grab active:cursor-grabbing`}
                        {...provided.dragHandleProps}
                      >
                        <Hand className="h-4 w-4" />
                      </div>
                      
                      <CardContent className="p-0 pt-8">
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
