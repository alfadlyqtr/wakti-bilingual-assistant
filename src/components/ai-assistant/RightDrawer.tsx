
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AIMode } from "./types";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { X, HelpCircle, BookOpen, BrainCircuit, Type, Palette, BarChart3, FileCheck } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AIMode;
  language: string;
  theme: string;
}

export function RightDrawer({ isOpen, onClose, activeMode, language, theme }: RightDrawerProps) {
  const { toggleLanguage } = useTheme();
  const direction = language === "ar" ? "rtl" : "ltr";
  const isDark = theme === "dark";
  
  // Background color for the drawer based on mode
  const getModeColor = () => {
    switch (activeMode) {
      case "general":
        return isDark ? "#858384" : "#060541";
      case "writer":
        return isDark ? "#fcfefd" : "#e9ceb0";
      case "creative":
        return isDark ? "#e9ceb0" : "#606062";
      case "assistant":
        return isDark ? "#0c0f14" : "#060541";
      default:
        return undefined;
    }
  };
  
  // Text color based on the background for readability
  const getTextColor = () => {
    if (isDark) {
      if (activeMode === "writer" || activeMode === "creative") {
        return "#0c0f14";
      }
      return "#ffffff";
    } else {
      if (activeMode === "general" || activeMode === "assistant") {
        return "#ffffff";
      }
      return "#060541";
    }
  };
  
  // Get the icon for the current mode
  const getModeIcon = () => {
    switch (activeMode) {
      case "general":
        return <BrainCircuit size={18} />;
      case "writer":
        return <Type size={18} />;
      case "creative":
        return <Palette size={18} />;
      case "assistant":
        return <FileCheck size={18} />;
      default:
        return <HelpCircle size={18} />;
    }
  };
  
  // Dynamic content based on the active mode
  const renderModeContent = () => {
    switch (activeMode) {
      case "general":
        return (
          <div className="space-y-4">
            <button 
              onClick={toggleLanguage}
              className="w-full py-3 px-4 rounded-lg bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-left flex justify-between items-center"
            >
              <span>{t("switchLanguage", language)}</span>
              <span className="text-sm opacity-70">{language === "ar" ? "English" : "العربية"}</span>
            </button>
            
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <h3 className="font-medium mb-2 px-2">{t("commonQuestions", language)}</h3>
              <div className="space-y-2">
                {[
                  t("whatCanYouDo", language),
                  t("howToCreateTask", language),
                  t("explainWAKTIFeatures", language),
                ].map((question, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left text-sm"
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
              <h3 className="font-medium mb-2 px-2">{t("tonePresets", language)}</h3>
              <div className="space-y-2">
                {[
                  t("professional", language),
                  t("casual", language),
                  t("friendly", language),
                  t("academic", language),
                ].map((tone, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left text-sm"
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <h3 className="font-medium mb-2 px-2">{t("lengthOptions", language)}</h3>
              <div className="space-y-2">
                {[
                  t("short", language),
                  t("medium", language),
                  t("long", language),
                ].map((length, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left text-sm"
                  >
                    {length}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <button className="flex items-center w-full py-2 px-3">
                <div className={cn(
                  "w-5 h-5 rounded border mr-2 flex items-center justify-center",
                  "border-black/30 dark:border-white/30"
                )}>
                  <div className="w-3 h-3 rounded-sm bg-black/70 dark:bg-white/70"></div>
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
              <h3 className="font-medium mb-2 px-2">{t("imageTools", language)}</h3>
              <div className="space-y-2">
                {[
                  t("textToImage", language),
                  t("imageToImage", language),
                  t("removeBg", language),
                  t("enhanceImage", language),
                ].map((tool, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left text-sm flex justify-between"
                  >
                    <span>{tool}</span>
                    <Toggle aria-label={tool} size="sm" />
                  </button>
                ))}
              </div>
            </div>
            
            <div className="border-t border-black/10 dark:border-white/10 pt-4">
              <h3 className="font-medium mb-2 px-2">{t("chartTypes", language)}</h3>
              <div className="space-y-2">
                {[
                  t("barChart", language),
                  t("lineChart", language),
                  t("pieChart", language),
                ].map((chart, idx) => (
                  <button
                    key={idx}
                    className="w-full py-2 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left text-sm"
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
              <h3 className="font-medium mb-2 px-2">{t("shortcuts", language)}</h3>
              <div className="space-y-2">
                <button className="w-full py-3 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left">
                  {t("createTask", language)}
                </button>
                <button className="w-full py-3 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left">
                  {t("createReminder", language)}
                </button>
                <button className="w-full py-3 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left">
                  {t("createEvent", language)}
                </button>
                <button className="w-full py-3 px-3 rounded-md bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-left">
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
            className="fixed right-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden flex flex-col"
            style={{ 
              backgroundColor: isDark ? "#606062" : "#e9ceb0", 
              color: getTextColor() 
            }}
            dir={direction}
            initial={{ x: language === "ar" ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header with Mode Title */}
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {getModeIcon()}
                <h2 className="font-medium text-lg">
                  {activeMode === "general" && t("generalSettings", language)}
                  {activeMode === "writer" && t("writerSettings", language)}
                  {activeMode === "creative" && t("creativeSettings", language)}
                  {activeMode === "assistant" && t("assistantSettings", language)}
                </h2>
              </div>
              <button onClick={onClose}>
                <X size={20} />
              </button>
            </div>
            
            {/* Sticky Instructions Panel */}
            <div className="p-4 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle size={16} />
                <h3 className="font-medium">
                  {t("instructions", language)}
                </h3>
              </div>
              <p className="text-sm opacity-80 mb-3">
                {activeMode === "general" && t("generalInstructions", language)}
                {activeMode === "writer" && t("writerInstructions", language)}
                {activeMode === "creative" && t("creativeInstructions", language)}
                {activeMode === "assistant" && t("assistantInstructions", language)}
              </p>
              
              <div className="flex items-center gap-2 mt-4">
                <BookOpen size={16} />
                <h3 className="font-medium">{t("knowledge", language)}</h3>
                <Toggle size="sm" />
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
