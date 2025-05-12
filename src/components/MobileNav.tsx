
import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ListCheck, 
  Calendar, 
  Sparkle, 
  AudioWaveform, 
  CalendarClock, 
  AlarmClock 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { motion } from "framer-motion";

export function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useTheme();
  
  const navItems = [
    {
      icon: ListCheck,
      label: "taskManagement" as TranslationKey,
      path: "/tasks",
    },
    {
      icon: Calendar,
      label: "calendar" as TranslationKey,
      path: "/calendar",
    },
    {
      icon: LayoutDashboard,
      label: "dashboard" as TranslationKey,
      path: "/dashboard",
      isMain: true,
    },
    {
      icon: Sparkle,
      label: "waktiAssistant" as TranslationKey,
      path: "/assistant",
    },
    {
      icon: AudioWaveform,
      label: "voiceSummary" as TranslationKey,
      path: "/voice-summary",
    },
    {
      icon: CalendarClock,
      label: "events" as TranslationKey,
      path: "/events",
    },
    {
      icon: AlarmClock,
      label: "reminders" as TranslationKey,
      path: "/reminders",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10">
      <div className="max-w-md mx-auto px-2 pb-3">
        <div className="relative">
          {/* Dock background */}
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-xl h-16 shadow-lg"></div>
          
          {/* Dock items */}
          <div className="absolute inset-0 flex items-center justify-around px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              
              // Main center item (dashboard)
              if (item.isMain) {
                return (
                  <motion.button
                    key={item.path}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex flex-col items-center justify-center -mt-6 relative",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <div className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs mt-1 font-medium">{t(item.label, language)}</span>
                  </motion.button>
                );
              }
              
              // Regular items
              return (
                <motion.button
                  key={item.path}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  onClick={() => navigate(item.path)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs mt-1">{t(item.label, language)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
