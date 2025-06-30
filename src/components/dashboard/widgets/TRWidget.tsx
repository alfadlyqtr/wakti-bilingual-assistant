
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, CheckSquare, Bell, Plus } from "lucide-react";

interface TRWidgetProps {
  language: 'en' | 'ar';
}

export const TRWidget: React.FC<TRWidgetProps> = ({ language }) => {
  const navigate = useNavigate();

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-red-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-green-500/10 via-transparent to-red-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-1">
            <CheckSquare className="h-4 w-4 text-green-500" />
            <Bell className="h-4 w-4 text-red-500" />
          </div>
          <h3 className="font-semibold text-lg text-foreground">
            {t("tasksReminders", language)}
          </h3>
        </div>

        {/* Simple Preview - No complex data fetching */}
        <div className="text-center py-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <CheckSquare className="h-8 w-8 text-green-500" />
            <Bell className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-sm text-foreground/70 mb-4 font-medium">
            {language === 'ar' ? 'إدارة المهام والتذكيرات' : 'Manage Tasks & Reminders'}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-primary/20 hover:border-primary/40 transition-all duration-300 text-foreground font-medium" 
            onClick={() => navigate('/tr')}
          >
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'فتح المهام والتذكيرات' : 'Open T&R'}
          </Button>
        </div>
      </div>
    </div>
  );
};
