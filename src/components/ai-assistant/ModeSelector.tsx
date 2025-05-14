
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { AIMode, ASSISTANT_MODES } from './types';
import { MessageSquare, Notebook, Palette, LifeBuoy } from "lucide-react";

interface ModeSelectorProps {
  activeMode: AIMode;
  setActiveMode: React.Dispatch<React.SetStateAction<AIMode>>;
}

// Map AI modes to their translation keys
const MODE_TRANSLATION_KEYS: Record<AIMode, TranslationKey> = {
  general: "chatMode",
  writer: "typeMode",
  creative: "createMode",
  assistant: "planMode"
};

export const ModeSelector: React.FC<ModeSelectorProps> = ({ activeMode, setActiveMode }) => {
  const { language, theme } = useTheme();
  const isDark = theme === "dark";

  // Get text color based on background for readability
  const getTextColor = (bgColor: string) => {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness >= 128 ? "#000000" : "#ffffff";
  };

  // Updated mode data
  const modes = [
    { 
      id: 'general', 
      label: MODE_TRANSLATION_KEYS.general, 
      icon: <MessageSquare className="h-4 w-4" />,
      color: isDark ? ASSISTANT_MODES[0].color.dark : ASSISTANT_MODES[0].color.light
    },
    { 
      id: 'writer', 
      label: MODE_TRANSLATION_KEYS.writer, 
      icon: <Notebook className="h-4 w-4" />,
      color: isDark ? ASSISTANT_MODES[1].color.dark : ASSISTANT_MODES[1].color.light
    },
    { 
      id: 'creative', 
      label: MODE_TRANSLATION_KEYS.creative, 
      icon: <Palette className="h-4 w-4" />,
      color: isDark ? ASSISTANT_MODES[2].color.dark : ASSISTANT_MODES[2].color.light
    },
    { 
      id: 'assistant', 
      label: MODE_TRANSLATION_KEYS.assistant, 
      icon: <LifeBuoy className="h-4 w-4" />,
      color: isDark ? ASSISTANT_MODES[3].color.dark : ASSISTANT_MODES[3].color.light
    },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none rounded-full bg-muted/50 p-1 max-w-full">
      {modes.map((mode) => {
        const isActive = activeMode === mode.id;
        const textColor = isActive ? getTextColor(mode.color) : undefined;
        
        return (
          <button
            key={mode.id}
            onClick={() => setActiveMode(mode.id as AIMode)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all whitespace-nowrap ${
              isActive 
                ? "text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeModeBg"
                className="absolute inset-0 rounded-full shadow-sm"
                style={{ 
                  backgroundColor: mode.color,
                  opacity: 1
                }}
                initial={false}
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            
            <span className="relative z-10 flex items-center gap-1.5">
              {React.cloneElement(mode.icon, { style: { color: textColor } })}
              <span style={{ color: textColor }}>
                {t(mode.label, language)}
              </span>
            </span>
            
            {isActive && (
              <motion.span
                className="absolute inset-0 rounded-full"
                initial={{ boxShadow: `0 0 0px ${mode.color}` }}
                animate={{ 
                  boxShadow: `0 0 8px ${mode.color}`,
                }}
                transition={{ 
                  duration: 1.5, 
                  repeat: Infinity, 
                  repeatType: "reverse" 
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
