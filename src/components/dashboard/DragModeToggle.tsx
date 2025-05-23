
import React from "react";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";

interface DragModeToggleProps {
  isDragging: boolean;
  onToggle: () => void;
  language: 'en' | 'ar';
}

export const DragModeToggle: React.FC<DragModeToggleProps> = ({ isDragging, onToggle, language }) => {
  return (
    <div className="flex justify-end mb-2">
      <Button 
        size="sm" 
        variant={isDragging ? "default" : "outline"} 
        onClick={onToggle}
        className="flex items-center gap-1"
      >
        <Hand className="h-3 w-3" />
        {isDragging 
          ? (language === 'ar' ? "إيقاف السحب" : "Exit Drag Mode") 
          : (language === 'ar' ? "تنظيم الأدوات" : "Organize Widgets")
        }
      </Button>
    </div>
  );
};
