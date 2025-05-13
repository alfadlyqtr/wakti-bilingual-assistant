
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { AIMode } from "./types";
import { t } from "@/utils/translations";
import { useTheme } from "@/providers/ThemeProvider";

interface RightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AIMode;
  language: string;
  theme: string;
}

export function RightPanel({ 
  isOpen, 
  onClose, 
  activeMode,
  language,
  theme
}: RightPanelProps) {
  const { toggleLanguage } = useTheme();
  
  const getPanelContent = () => {
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
                    <span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-toggle-right opacity-70">
                        <rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="16" cy="12" r="2"/>
                      </svg>
                    </span>
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
          
          {/* Panel */}
          <motion.div 
            className="fixed right-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden flex flex-col"
            style={{ 
              backgroundColor: theme === "dark" ? "#606062" : "#e9ceb0",
              color: theme === "dark" ? "#ffffff" : "#000000"
            }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center">
              <h2 className="font-medium text-lg">
                {activeMode === "general" && t("generalSettings", language)}
                {activeMode === "writer" && t("writerSettings", language)}
                {activeMode === "creative" && t("creativeSettings", language)}
                {activeMode === "assistant" && t("assistantSettings", language)}
              </h2>
              <button onClick={onClose}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {getPanelContent()}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
