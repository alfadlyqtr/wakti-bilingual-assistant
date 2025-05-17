
import React from 'react';
import { motion } from 'framer-motion';
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Notebook, Palette, LifeBuoy } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { AIMode } from './types';

interface ModePanelProps {
  activeMode: AIMode;
  setActiveMode: React.Dispatch<React.SetStateAction<AIMode>>;
}

export const ModePanel: React.FC<ModePanelProps> = ({ activeMode, setActiveMode }) => {
  const { language } = useTheme();

  const modes = [
    { id: 'general', label: 'general', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'writer', label: 'writer', icon: <Notebook className="h-4 w-4" /> },
    { id: 'creative', label: 'creative', icon: <Palette className="h-4 w-4" /> },
    { id: 'assistant', label: 'assistant', icon: <LifeBuoy className="h-4 w-4" /> },
  ];

  const handleModeChange = (value: string) => {
    setActiveMode(value as AIMode);
  };

  return (
    <Tabs 
      value={activeMode} 
      onValueChange={handleModeChange}
      className="w-full"
    >
      <TabsList className="w-full justify-between rounded-full bg-muted/50 p-1">
        {modes.map((mode) => (
          <TabsTrigger
            key={mode.id}
            value={mode.id}
            className="relative flex items-center gap-1.5 rounded-full data-[state=active]:shadow-sm"
          >
            {activeMode === mode.id && (
              <motion.div
                layoutId="activeModeBg"
                className="absolute inset-0 bg-background rounded-full border shadow-sm"
                initial={false}
                transition={{ type: "spring", duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {mode.icon}
              <span className="hidden sm:inline-block">
                {t(mode.label as TranslationKey, language)}
              </span>
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
