
import React from 'react';
import { TabsContent, Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notebook, Palette, BrainCog, LifeBuoy } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

interface ModePanelProps {
  activeMode: string;
  setActiveMode: React.Dispatch<React.SetStateAction<string>>;
}

export const ModePanel: React.FC<ModePanelProps> = ({ activeMode, setActiveMode }) => {
  const { language } = useTheme();

  const modes = [
    { id: 'general', label: 'generalMode', icon: <BrainCog className="h-4 w-4 mr-1" /> },
    { id: 'writer', label: 'writerMode', icon: <Notebook className="h-4 w-4 mr-1" /> },
    { id: 'creative', label: 'creativeMode', icon: <Palette className="h-4 w-4 mr-1" /> },
    { id: 'assistant', label: 'assistantMode', icon: <LifeBuoy className="h-4 w-4 mr-1" /> },
  ];

  const handleModeChange = (value: string) => {
    setActiveMode(value);
  };

  return (
    <Tabs 
      value={activeMode} 
      onValueChange={handleModeChange}
      className="w-full mb-4"
    >
      <TabsList className="w-full justify-around">
        {modes.map((mode) => (
          <TabsTrigger
            key={mode.id}
            value={mode.id}
            className="flex items-center text-xs sm:text-sm py-1"
          >
            {mode.icon}
            <span className="hidden sm:inline-block">
              {t(mode.label as TranslationKey, language)}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
};
