
import { useNavigate, useLocation } from "react-router-dom";
import { 
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
  
  // Navigation items - removed dashboard from the dock as requested
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
    <div className="max-w-md mx-auto px-2 pb-3">
      <div className="relative">
        {/* Dock background */}
        <div className="bg-background/95 backdrop-blur-sm border border-border rounded-2xl h-16 shadow-lg"></div>
        
        {/* Dock items with balanced spacing */}
        <div className="absolute inset-0 flex items-center justify-between px-6">
          {/* Left side items */}
          <div className="flex space-x-6">
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
          
          {/* Right side items */}
          <div className="flex space-x-6">
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
  );
}
