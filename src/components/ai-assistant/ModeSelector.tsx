
import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { AIMode } from './types';
import { MessageSquare, Notebook, Palette, LifeBuoy } from "lucide-react";

interface ModeSelectorProps {
  activeMode: AIMode;
  setActiveMode: React.Dispatch<React.SetStateAction<AIMode>>;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ activeMode, setActiveMode }) => {
  const { language, theme } = useTheme();
  const isDark = theme === "dark";

  const modes = [
    { 
      id: 'general', 
      label: 'generalMode', 
      icon: <MessageSquare className="h-4 w-4" />,
      color: isDark ? "#858384" : "#060541"
    },
    { 
      id: 'writer', 
      label: 'writerMode', 
      icon: <Notebook className="h-4 w-4" />,
      color: isDark ? "#fcfefd" : "#e9ceb0"  
    },
    { 
      id: 'creative', 
      label: 'creativeMode', 
      icon: <Palette className="h-4 w-4" />,
      color: isDark ? "#e9ceb0" : "#606062"
    },
    { 
      id: 'assistant', 
      label: 'assistantMode', 
      icon: <LifeBuoy className="h-4 w-4" />,
      color: isDark ? "#0c0f14" : "#060541"
    },
  ];

  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none rounded-full bg-muted/50 p-1 max-w-full">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setActiveMode(mode.id as AIMode)}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full transition-all whitespace-nowrap ${
            activeMode === mode.id 
              ? "text-foreground" 
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {activeMode === mode.id && (
            <motion.div
              layoutId="activeModeBg"
              className="absolute inset-0 rounded-full shadow-sm"
              style={{ 
                backgroundColor: mode.color,
                opacity: isDark ? 1 : 0.15
              }}
              initial={false}
              transition={{ type: "spring", duration: 0.6 }}
            />
          )}
          
          <span className="relative z-10 flex items-center gap-1.5">
            {mode.icon}
            <span>
              {t(mode.label as TranslationKey, language)}
            </span>
          </span>
          
          {activeMode === mode.id && (
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
      ))}
    </div>
  );
};
