
import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { cn } from "@/lib/utils";
import { AIMode, ASSISTANT_MODES } from "./types";

interface ModePanelProps {
  activeMode: AIMode;
  onModeChange: (mode: AIMode) => void;
}

export function ModePanel({ activeMode, onModeChange }: ModePanelProps) {
  const { theme, language } = useTheme();
  
  return (
    <div className="p-2 flex justify-center">
      <div className="flex p-1 bg-muted rounded-full">
        {ASSISTANT_MODES.map((mode) => (
          <motion.button
            key={mode.id}
            onClick={() => onModeChange(mode.id)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all relative",
              activeMode === mode.id ? "" : "text-muted-foreground"
            )}
            whileTap={{ scale: 0.95 }}
          >
            {activeMode === mode.id && (
              <motion.span
                className="absolute inset-0 rounded-full"
                layoutId="activeModeBg"
                style={{ 
                  backgroundColor: theme === "dark" 
                    ? mode.color.dark 
                    : mode.color.light,
                  opacity: theme === "dark" ? 0.2 : 0.15
                }}
                initial={false}
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            <span className="relative z-10">
              {t(mode.id + "Mode", language)}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
