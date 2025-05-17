
import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { AIMode, ASSISTANT_MODES } from "./types";
import { Button } from "@/components/ui/button";
import { MessageSquare, Edit3, Paintbrush, Calendar } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

export interface ModeSelectorProps {
  activeMode: AIMode;
  setActiveMode: (mode: AIMode) => void;
  language: "en" | "ar";
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  setActiveMode,
  language
}) => {
  const { theme } = useTheme();
  const currentTheme = theme === "dark" ? "dark" : "light";

  // Icon mapping for each mode
  const getIconForMode = (mode: AIMode) => {
    switch (mode) {
      case "general":
        return <MessageSquare className="h-4 w-4 mr-2" />;
      case "writer":
        return <Edit3 className="h-4 w-4 mr-2" />;
      case "creative":
        return <Paintbrush className="h-4 w-4 mr-2" />;
      case "assistant":
        return <Calendar className="h-4 w-4 mr-2" />;
      default:
        return <MessageSquare className="h-4 w-4 mr-2" />;
    }
  };

  return (
    <div className="flex justify-center py-2 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto hide-scrollbar">
      <div className="flex space-x-2">
        {ASSISTANT_MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const colorKey = currentTheme as keyof typeof mode.color;
          
          return (
            <Button
              key={mode.id}
              onClick={() => setActiveMode(mode.id as AIMode)}
              variant="ghost"
              size="sm"
              className={`relative px-3 py-1 rounded-full transition-all ${
                isActive ? "text-white" : "text-foreground hover:text-foreground/80"
              }`}
              style={{
                backgroundColor: isActive ? mode.color[colorKey] : "transparent",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="mode-bubble"
                  className="absolute inset-0 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center text-xs font-medium">
                {getIconForMode(mode.id as AIMode)}
                {t(mode.id as TranslationKey, language)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
