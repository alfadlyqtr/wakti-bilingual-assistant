
import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings, Eye, EyeOff } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface WidgetSettings {
  tasksWidget: boolean;
  calendarWidget: boolean;
  remindersWidget: boolean;
  quoteWidget: boolean;
}

interface DragModeToggleProps {
  dragMode: boolean;
  setDragMode: (enabled: boolean) => void;
  widgets: WidgetSettings;
  updateWidgetVisibility: (widgetId: keyof WidgetSettings, visible: boolean) => void;
}

export function DragModeToggle({ 
  dragMode, 
  setDragMode, 
  widgets, 
  updateWidgetVisibility 
}: DragModeToggleProps) {
  const widgetOptions = [
    { id: 'tasksWidget' as const, label: 'Tasks Widget' },
    { id: 'calendarWidget' as const, label: 'Calendar Widget' },
    { id: 'remindersWidget' as const, label: 'Reminders Widget' },
    { id: 'quoteWidget' as const, label: 'Quote Widget' }
  ];

  return (
    <div className="flex items-center gap-2 mb-4">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Customize
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Dashboard Settings</h4>
              <div className="flex items-center space-x-2">
                <Switch
                  id="drag-mode"
                  checked={dragMode}
                  onCheckedChange={setDragMode}
                />
                <Label htmlFor="drag-mode">Edit Layout</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-medium">Widget Visibility</h4>
              {widgetOptions.map((option) => (
                <div key={option.id} className="flex items-center justify-between">
                  <Label htmlFor={option.id} className="text-sm">
                    {option.label}
                  </Label>
                  <div className="flex items-center space-x-2">
                    {widgets[option.id] ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                    <Switch
                      id={option.id}
                      checked={widgets[option.id]}
                      onCheckedChange={(checked) => 
                        updateWidgetVisibility(option.id, checked)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
