
import React from "react";
import { Button } from "@/components/ui/button";
import { Hand } from "lucide-react";
import { t } from "@/utils/translations";

interface DragModeToggleProps {
  isDragging: boolean;
  onToggle: () => void;
  language: 'en' | 'ar';
  displayName?: string;
}

export const DragModeToggle: React.FC<DragModeToggleProps> = ({ isDragging, onToggle, language, displayName }) => {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          variant={isDragging ? "default" : "outline"} 
          onClick={onToggle}
          className="flex items-center gap-1"
        >
          <Hand className="h-3 w-3" />
          {isDragging 
            ? t("exitDragMode", language)
            : t("organizeWidgets", language)
          }
        </Button>
        {displayName && (
          <span
            className="ml-3 text-base font-semibold text-neutral-700 dark:text-neutral-100"
            style={{ fontFamily: 'inherit', fontWeight: 600 }}
            dir={language === 'ar' ? 'rtl' : 'ltr'}
          >
            {t("welcome", language)}, {displayName}
          </span>
        )}
      </div>
    </div>
  );
};
