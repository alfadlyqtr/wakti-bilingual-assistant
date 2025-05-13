
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Calendar, 
  Sparkle, 
  AudioWaveform, 
  CalendarClock, 
  ListCheck
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
  
  // Navigation items - combined Tasks + Reminders into a single menu item
  const navItems = [
    // Left side items (3)
    {
      icon: ListCheck,
      label: "taskAndReminders" as TranslationKey,
      path: "/tasks",
      position: "left"
    },
    {
      icon: Calendar,
      label: "calendar" as TranslationKey,
      path: "/calendar",
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
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-md mx-auto px-6 pb-4 pt-2">
        <div className="relative">
          {/* Dock background */}
          <div className="bg-background/95 backdrop-blur-sm border border-border rounded-2xl h-16 shadow-lg"></div>
          
          {/* Dock items with centered layout */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex w-full px-6 justify-between">
              {/* Left side items */}
              <div className="flex space-x-12">
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
              <div className="flex space-x-12">
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
    </div>
  );
}
