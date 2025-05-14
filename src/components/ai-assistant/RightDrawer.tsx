
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AIMode, ASSISTANT_MODES } from "./types";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { X, HelpCircle, BookOpen, BrainCircuit, Type, Palette, FileCheck } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "@/components/ui/use-toast";

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AIMode;
  language: string;
  theme: string;
}

// Define user bubble colors per mode
const USER_BUBBLE_COLORS = {
  general: {
    dark: "#757373",
    light: "#757373"
  },
  writer: {
    dark: "#1EAEDB",   // Bright blue
    light: "#BED7F9"   // Lighter soft blue
  },
  creative: {
    dark: "#d4ba9f",
    light: "#d4ba9f"
  },
  assistant: {
    dark: "#C026D3",   // Magenta pink shade
    light: "#9B87F5"   // Primary purple
  }
};

export function RightDrawer({ isOpen, onClose, activeMode, language, theme }: RightDrawerProps) {
  const { toggleLanguage } = useTheme();
  const direction = language === "ar" ? "rtl" : "ltr";
  const isDark = theme === "dark";
  
  // State for toggling knowledge base
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);
  const [grammarCheckEnabled, setGrammarCheckEnabled] = useState(true);
  const [imageTools, setImageTools] = useState({
    textToImage: true,
    imageToImage: false,
    removeBg: false,
    enhanceImage: false
  });
  
  // Get drawer background color based on active mode
  const getDrawerBgColor = (mode: AIMode) => {
    return isDark ? 
      USER_BUBBLE_COLORS[mode].dark : 
      USER_BUBBLE_COLORS[mode].light;
  };
  
  const drawerBgColor = getDrawerBgColor(activeMode);
  
  // Get text color based on background for readability
  const getTextColor = (bgColor: string) => {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness >= 128 ? "#000000" : "#ffffff";
  };
  
  const textColor = getTextColor(drawerBgColor || "#000000");
  
  // Get the icon for the current mode
  const getModeIcon = () => {
    switch (activeMode) {
      case "general":
        return <BrainCircuit size={18} style={{ color: textColor }} />;
      case "writer":
        return <Type size={18} style={{ color: textColor }} />;
      case "creative":
        return <Palette size={18} style={{ color: textColor }} />;
      case "assistant":
        return <FileCheck size={18} style={{ color: textColor }} />;
      default:
        return <HelpCircle size={18} style={{ color: textColor }} />;
    }
  };
  
  // Handle common question clicks
  const handleCommonQuestionClick = (question: string) => {
    toast({
      title: t("questionSelected" as TranslationKey, language),
      description: question,
      duration: 3000
    });
    onClose();
  };
  
  // Handle tone preset selection
  const handleTonePresetClick = (tone: string) => {
    toast({
      title: t("toneSelected" as TranslationKey, language),
      description: tone,
      duration: 3000
    });
  };
  
  // Handle length option selection
  const handleLengthOptionClick = (length: string) => {
    toast({
      title: t("lengthSelected" as TranslationKey, language),
      description: length,
      duration: 3000
    });
  };
  
  // Handle shortcut action
  const handleShortcutClick = (action: string) => {
    toast({
      title: t("shortcutSelected" as TranslationKey, language),
      description: action,
      duration: 3000
    });
    onClose();
  };
  
  // Handle toggle for image tools
  const handleImageToolToggle = (tool: keyof typeof imageTools) => {
    setImageTools(prev => ({
      ...prev,
      [tool]: !prev[tool]
    }));
    
    toast({
      title: imageTools[tool] ? t("toolDisabled" as TranslationKey, language) : t("toolEnabled" as TranslationKey, language),
      description: t(tool as TranslationKey, language),
      duration: 3000
    });
  };
  
  // Handle chart type selection
  const handleChartTypeClick = (chartType: string) => {
    toast({
      title: t("chartSelected" as TranslationKey, language),
      description: chartType,
      duration: 3000
    });
  };
  
  // Dynamic content based on the active mode
  const renderModeContent = () => {
    switch (activeMode) {
      case "general":
        return (
          <div className="space-y-4">
            <button 
              onClick={toggleLanguage}
              className="w-full py-3 px-4 rounded-lg text-left flex justify-between items-center"
              style={{ 
                backgroundColor: `${textColor}10`,
                color: textColor
              }}
            >
              <span>{t("switchLanguage", language)}</span>
              <span className="text-sm opacity-70">{language === "ar" ? "English" : "العربية"}</span>
            </button>
            
            <div className="border-t pt-4" style={{ borderColor: `${textColor}20` }}>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("commonQuestions", language)}
              </h3>
              <div className="space-y-2">
                {[
                  t("whatCanYouDo", language),
                  t("howToCreateTask", language),
                  t("explainWAKTIFeatures", language),
                ].map((question, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md text-left text-sm"
                    style={{ 
                      backgroundColor: `${textColor}10`,
                      color: textColor
                    }}
                    onClick={() => handleCommonQuestionClick(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      
      case "writer":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("tonePresets", language)}
              </h3>
              <div className="space-y-2">
                {[
                  t("professional", language),
                  t("casual", language),
                  t("friendly", language),
                  t("academic", language),
                ].map((tone, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md text-left text-sm"
                    style={{ 
                      backgroundColor: `${textColor}10`,
                      color: textColor
                    }}
                    onClick={() => handleTonePresetClick(tone)}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4" style={{ borderColor: `${textColor}20` }}>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("lengthOptions", language)}
              </h3>
              <div className="space-y-2">
                {[
                  t("short", language),
                  t("medium", language),
                  t("long", language),
                ].map((length, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md text-left text-sm"
                    style={{ 
                      backgroundColor: `${textColor}10`,
                      color: textColor
                    }}
                    onClick={() => handleLengthOptionClick(length)}
                  >
                    {length}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4" style={{ borderColor: `${textColor}20` }}>
              <button 
                className="flex items-center w-full py-2 px-3"
                style={{ color: textColor }}
                onClick={() => setGrammarCheckEnabled(!grammarCheckEnabled)}
              >
                <div className="w-5 h-5 rounded border mr-2 flex items-center justify-center"
                  style={{ borderColor: `${textColor}40` }}
                >
                  {grammarCheckEnabled && (
                    <div 
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: `${textColor}70` }}
                    ></div>
                  )}
                </div>
                <span>{t("grammarCheck", language)}</span>
              </button>
            </div>
          </div>
        );
      
      case "creative":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("imageTools", language)}
              </h3>
              <div className="space-y-2">
                {Object.keys(imageTools).map((tool, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md text-left text-sm flex justify-between"
                    style={{ 
                      backgroundColor: `${textColor}10`,
                      color: textColor
                    }}
                    onClick={() => handleImageToolToggle(tool as keyof typeof imageTools)}
                  >
                    <span>{t(tool as TranslationKey, language)}</span>
                    <Toggle 
                      pressed={imageTools[tool as keyof typeof imageTools]}
                      onPressedChange={() => handleImageToolToggle(tool as keyof typeof imageTools)}
                      aria-label={t(tool as TranslationKey, language)} 
                      size="sm"
                      style={{ 
                        backgroundColor: imageTools[tool as keyof typeof imageTools] 
                          ? `${textColor}70` 
                          : `${textColor}30`,
                        color: textColor
                      }} 
                    />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4" style={{ borderColor: `${textColor}20` }}>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("chartTypes", language)}
              </h3>
              <div className="space-y-2">
                {[
                  t("barChart", language),
                  t("lineChart", language),
                  t("pieChart", language),
                ].map((chart, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md text-left text-sm"
                    style={{ 
                      backgroundColor: `${textColor}10`,
                      color: textColor
                    }}
                    onClick={() => handleChartTypeClick(chart)}
                  >
                    {chart}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      
      case "assistant":
        return (
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2 px-2" style={{ color: textColor }}>
                {t("shortcuts", language)}
              </h3>
              <div className="space-y-2">
                <button 
                  className="w-full py-3 px-3 rounded-md text-left"
                  style={{ 
                    backgroundColor: `${textColor}10`,
                    color: textColor
                  }}
                  onClick={() => handleShortcutClick(t("createTask", language))}
                >
                  {t("createTask", language)}
                </button>
                <button 
                  className="w-full py-3 px-3 rounded-md text-left"
                  style={{ 
                    backgroundColor: `${textColor}10`,
                    color: textColor
                  }}
                  onClick={() => handleShortcutClick(t("createReminder", language))}
                >
                  {t("createReminder", language)}
                </button>
                <button 
                  className="w-full py-3 px-3 rounded-md text-left"
                  style={{ 
                    backgroundColor: `${textColor}10`,
                    color: textColor
                  }}
                  onClick={() => handleShortcutClick(t("createEvent", language))}
                >
                  {t("createEvent", language)}
                </button>
                <button 
                  className="w-full py-3 px-3 rounded-md text-left"
                  style={{ 
                    backgroundColor: `${textColor}10`,
                    color: textColor
                  }}
                  onClick={() => handleShortcutClick(t("viewCalendar", language))}
                >
                  {t("viewCalendar", language)}
                </button>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Get the title for the current mode
  const getModeTitle = () => {
    switch (activeMode) {
      case "general":
        return t("chatSettings" as TranslationKey, language);
      case "writer":
        return t("typeSettings" as TranslationKey, language);
      case "creative":
        return t("createSettings" as TranslationKey, language);
      case "assistant":
        return t("planSettings" as TranslationKey, language);
      default:
        return t("settings", language);
    }
  };

  // Get the instructions for the current mode
  const getModeInstructions = () => {
    switch (activeMode) {
      case "general":
        return t("chatInstructions" as TranslationKey, language);
      case "writer":
        return t("typeInstructions" as TranslationKey, language);
      case "creative":
        return t("createInstructions" as TranslationKey, language);
      case "assistant":
        return t("planInstructions" as TranslationKey, language);
      default:
        return t("instructions", language);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          
          {/* Drawer */}
          <motion.div 
            className="fixed right-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden flex flex-col pointer-events-auto"
            style={{ 
              backgroundColor: drawerBgColor,
              color: textColor 
            }}
            dir={direction}
            initial={{ x: language === "ar" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header with Mode Title */}
            <div className="p-4 border-b flex justify-between items-center"
              style={{ borderColor: `${textColor}30` }}
            >
              <div className="flex items-center gap-2">
                {getModeIcon()}
                <h2 className="font-medium text-lg" style={{ color: textColor }}>
                  {getModeTitle()}
                </h2>
              </div>
              <button onClick={onClose} style={{ color: textColor }}>
                <X size={20} />
              </button>
            </div>
            
            {/* Sticky Instructions Panel */}
            <div className="p-4 border-b" style={{ borderColor: `${textColor}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={16} style={{ color: textColor }} />
                <h3 className="font-medium" style={{ color: textColor }}>
                  {t("instructions", language)}
                </h3>
              </div>
              <p className="text-sm mb-3" style={{ color: `${textColor}CC` }}>
                {getModeInstructions()}
              </p>
              
              <div className="flex items-center gap-2 mt-4">
                <BookOpen size={16} style={{ color: textColor }} />
                <h3 className="font-medium" style={{ color: textColor }}>
                  {t("knowledge", language)}
                </h3>
                <Toggle 
                  pressed={knowledgeEnabled}
                  onPressedChange={() => setKnowledgeEnabled(!knowledgeEnabled)}
                  size="sm"
                  style={{ 
                    backgroundColor: knowledgeEnabled ? `${textColor}70` : `${textColor}30`,
                    color: textColor
                  }} 
                />
              </div>
            </div>
            
            {/* Dynamic Content Based on Mode */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderModeContent()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
