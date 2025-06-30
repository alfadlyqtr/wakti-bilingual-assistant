
import React from "react";
import { Button } from "@/components/ui/button";
import { format, addDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, Calendar } from "lucide-react";

interface CalendarWidgetProps {
  language: 'en' | 'ar';
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ language }) => {
  const navigate = useNavigate();

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
            {format(new Date(), "MMMM yyyy")}
          </h3>
        </div>

        {/* Today & Tomorrow Preview */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 p-3 rounded-xl bg-blue-500 text-white text-center">
            <div className="font-bold text-lg">{format(new Date(), "d")}</div>
            <div className="text-xs opacity-90">{t("today", language)}</div>
          </div>
          <div className="flex-1 p-3 rounded-xl bg-white border border-blue-500/20 text-blue-500 text-center">
            <div className="font-bold text-lg">{format(addDays(new Date(), 1), "d")}</div>
            <div className="text-xs opacity-90">{t("tomorrow", language)}</div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full bg-white/10 backdrop-blur-sm border-white/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all duration-300"
          onClick={() => navigate('/calendar')}
        >
          {t("calendar_open", language)}
        </Button>
      </div>
    </div>
  );
};
