
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { t } from "@/utils/translations";
import { Hand, Heart, Plus } from "lucide-react";

interface Maw3dWidgetProps {
  language: 'en' | 'ar';
}

export const Maw3dWidget: React.FC<Maw3dWidgetProps> = ({ language }) => {
  const navigate = useNavigate();

  return (
    <div className="relative group" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background/80 via-background/40 to-background/60 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-pink-500/5 rounded-xl"></div>
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/10 rounded-xl"></div>
      
      {/* Drag handle with glass effect */}
      <div className={`absolute top-2 z-20 p-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 cursor-grab active:cursor-grabbing group-hover:scale-110 ${language === 'ar' ? 'right-2' : 'left-2'}`}>
        <Hand className="h-3 w-3 text-primary/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 pt-12">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="h-5 w-5 text-purple-500" />
          <h3 className="font-semibold text-lg bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            {t("maw3dEvents", language)}
          </h3>
        </div>

        {/* Simple Preview - No complex data fetching */}
        <div className="text-center py-6">
          <Heart className="mx-auto h-8 w-8 text-purple-500/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'ar' ? 'إنشاء وإدارة أحداث Maw3d' : 'Create & Manage Maw3d Events'}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-purple-500/20 hover:border-purple-500/40 transition-all duration-300" 
            onClick={() => navigate('/maw3d-events')}
          >
            <Plus className="h-4 w-4 mr-2" />
            {language === 'ar' ? 'فتح Maw3d' : 'Open Maw3d'}
          </Button>
        </div>
      </div>
    </div>
  );
};
