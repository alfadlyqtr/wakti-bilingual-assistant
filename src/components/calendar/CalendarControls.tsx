
import React from "react";
import { format } from "date-fns";
import { arSA, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/utils/translations";
import { cn } from "@/lib/utils";

interface CalendarControlsProps {
  currentDate: Date;
  view: 'day' | 'week' | 'month' | 'year';
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  language: 'en' | 'ar';
}

export const CalendarControls: React.FC<CalendarControlsProps> = ({
  currentDate,
  view,
  onPrevious,
  onNext,
  onToday,
  language,
}) => {
  const locale = language === 'ar' ? arSA : enUS;
  
  const formatString = 
    view === 'year' ? 'yyyy' :
    view === 'month' ? 'MMMM yyyy' :
    view === 'week' ? "'Week of' dd MMM yyyy" :
    'EEEE, dd MMMM yyyy';
  
  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onPrevious}
          aria-label="Previous"
          className={cn(language === 'ar' ? 'order-2' : 'order-1')}
        >
          <ChevronLeft className={cn("h-4 w-4", language === 'ar' && "rotate-180")} />
        </Button>
        
        <div className={cn("text-lg font-semibold px-2", language === 'ar' ? 'order-1' : 'order-2')}>
          {format(currentDate, formatString, { locale })}
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onNext}
          aria-label="Next"
          className={cn(language === 'ar' ? 'order-1' : 'order-3')}
        >
          <ChevronRight className={cn("h-4 w-4", language === 'ar' && "rotate-180")} />
        </Button>
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onToday}
      >
        {t("today", language)}
      </Button>
    </div>
  );
};
