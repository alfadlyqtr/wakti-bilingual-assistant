
import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { AIMode, ASSISTANT_MODES } from "./types";
import { Button } from "@/components/ui/button";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

// Helper function to translate mode names
const getModeLabel = (mode: AIMode, language: string): string => {
  // Translation key naming convention: mode_[mode_id]
  const translationKey = `mode_${mode}` as TranslationKey;
  return t(translationKey, language) || mode;
};

export interface ModeSelectorProps {
  activeMode: AIMode;
  setActiveMode: (mode: AIMode) => void;
  language: string;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  setActiveMode,
  language
}) => {
  const { theme } = useTheme();
  const currentTheme = theme === "dark" ? "dark" : "light";

  return (
    <div className="flex justify-center py-2 px-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto hide-scrollbar">
      <div className="flex space-x-2">
        {ASSISTANT_MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const colorKey = currentTheme as keyof typeof mode.color;
          
          return (
            <Button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
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
              <span className="relative z-10 text-xs font-medium">
                {getModeLabel(mode.id, language)}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
