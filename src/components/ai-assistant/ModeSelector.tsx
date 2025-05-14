
import React from "react";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { ASSISTANT_MODES, AIMode, MODE_NAME_MAP } from "./types";
import { MessageSquare, Notebook, Palette, LifeBuoy } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

interface ModeSelectorProps {
  activeMode: AIMode;
  setActiveMode: (mode: AIMode) => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  setActiveMode,
}) => {
  const { theme, language } = useTheme();
  
  // Get the icon component for a mode ID
  const getModeIcon = (modeId: string) => {
    switch (modeId) {
      case "general": return <MessageSquare size={16} />;
      case "writer": return <Notebook size={16} />;
      case "creative": return <Palette size={16} />;
      case "assistant": return <LifeBuoy size={16} />;
      default: return null;
    }
  };
  
  return (
    <div className="w-full flex justify-center">
      <div className="flex space-x-1 bg-muted/40 p-1 rounded-full relative">
        {ASSISTANT_MODES.map((mode) => {
          const isActive = activeMode === mode.id;
          const modeColor = theme === "dark" ? mode.color.dark : mode.color.light;
          
          return (
            <div key={mode.id} className="relative">
              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 rounded-full"
                  style={{
                    backgroundColor: modeColor,
                    opacity: 0.15
                  }}
                  transition={{ type: 'spring', duration: 0.5 }}
                />
              )}
              <Button
                variant="ghost"
                size="sm"
                className={`rounded-full relative px-3 py-1 h-8 text-xs font-medium transition-all duration-200 ${
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveMode(mode.id as AIMode)}
                style={{
                  borderColor: isActive ? modeColor : "transparent",
                  boxShadow: isActive ? `0 0 8px ${modeColor}30` : "none",
                }}
              >
                <div className="flex items-center gap-1.5">
                  {getModeIcon(mode.id)}
                  <span>
                    {t(mode.id as TranslationKey, language)}
                  </span>
                </div>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
