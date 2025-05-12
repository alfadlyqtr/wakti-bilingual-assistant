
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
  
  // Restructured navigation items with exactly 3 on each side of dashboard
  const navItems = [
    // Left side items (3)
    {
      icon: ListCheck,
      label: "taskManagement" as TranslationKey,
      path: "/tasks",
      position: "left"
    },
    {
      icon: Calendar,
      label: "calendar" as TranslationKey,
      path: "/calendar",
      position: "left"
    },
    {
      icon: AlarmClock,
      label: "reminders" as TranslationKey,
      path: "/reminders",
      position: "left"
    },
    // Center item
    {
      icon: LayoutDashboard,
      label: "dashboard" as TranslationKey,
      path: "/dashboard",
      isMain: true,
      position: "center"
    },
    // Right side items (3)
    {
      icon: Sparkle,
      label: "waktiAssistant" as TranslationKey,
      path: "/assistant",
      position: "right"
    },
    {
      icon: AudioWaveform,
      label: "voiceSummary" as TranslationKey,
      path: "/voice-summary",
      position: "right"
    },
    {
      icon: CalendarClock,
      label: "events" as TranslationKey,
      path: "/events",
      position: "right"
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-10">
      <div className="max-w-md mx-auto px-2 pb-3">
        <div className="relative">
          {/* Improved dock background with more curve */}
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-2xl h-16 shadow-lg"></div>
          
          {/* Dock items with improved spacing */}
          <div className="absolute inset-0 flex items-center justify-between px-4">
            {/* Left side items */}
            <div className="flex space-x-4 justify-end flex-1">
              {navItems
                .filter(item => item.position === "left")
                .map((item) => {
                  const isActive = location.pathname === item.path;
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
                      <span className="text-[10px] mt-1">{t(item.label, language)}</span>
                    </motion.button>
                  );
                })}
            </div>
            
            {/* Center Dashboard Button - Larger and more prominent */}
            {navItems
              .filter(item => item.isMain)
              .map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <motion.button
                    key={item.path}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "flex flex-col items-center justify-center -mt-6 z-10 mx-1",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}
                    onClick={() => navigate(item.path)}
                  >
                    <div className="bg-primary text-primary-foreground p-4 rounded-full shadow-lg">
                      <item.icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs mt-1 font-medium">{t(item.label, language)}</span>
                  </motion.button>
                );
              })}
            
            {/* Right side items */}
            <div className="flex space-x-4 justify-start flex-1">
              {navItems
                .filter(item => item.position === "right")
                .map((item) => {
                  const isActive = location.pathname === item.path;
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
                      <span className="text-[10px] mt-1">{t(item.label, language)}</span>
                    </motion.button>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
