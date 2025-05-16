
import React from "react";
import { X, Settings, Globe, HelpCircle, Moon, Sun } from "lucide-react";
import { Button } from "../ui/button";
import { AIMode } from "./types";
import { useTheme } from "@/providers/ThemeProvider";

export interface RightDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: AIMode;
  language: string;
}

export const RightDrawer: React.FC<RightDrawerProps> = ({
  isOpen,
  onClose,
  activeMode,
  language
}) => {
  const { toggleTheme, toggleLanguage, theme, language: currentLanguage } = useTheme();
  
  const drawerClasses = isOpen 
    ? "translate-x-0" 
    : "translate-x-full";
    
  return (
    <>
      {/* Overlay when drawer is open */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/30 z-40"
          onClick={onClose}
        />
      )}
    
      <div
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-white dark:bg-zinc-900 shadow-lg transform transition-transform duration-300 ease-in-out ${drawerClasses}`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <div className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            <h2 className="text-lg font-semibold">
              {language === "ar" ? "الإعدادات" : "Settings"}
            </h2>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4">
          <div className="space-y-4">
            {/* Language toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <div className="flex items-center">
                <Globe className="h-5 w-5 mr-3" />
                <span>{language === "ar" ? "اللغة" : "Language"}</span>
              </div>
              <Button onClick={toggleLanguage} variant="outline" size="sm">
                {currentLanguage === "en" ? "العربية" : "English"}
              </Button>
            </div>
            
            {/* Theme toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <div className="flex items-center">
                {theme === 'dark' ? (
                  <Moon className="h-5 w-5 mr-3" />
                ) : (
                  <Sun className="h-5 w-5 mr-3" />
                )}
                <span>{language === "ar" ? "المظهر" : "Theme"}</span>
              </div>
              <Button onClick={toggleTheme} variant="outline" size="sm">
                {theme === 'dark' 
                  ? (language === "ar" ? "فاتح" : "Light") 
                  : (language === "ar" ? "داكن" : "Dark")}
              </Button>
            </div>
            
            {/* Help section */}
            <div className="mt-6">
              <h3 className="font-medium mb-2 flex items-center">
                <HelpCircle className="h-4 w-4 mr-2" />
                {language === "ar" ? "أسئلة شائعة" : "Common Questions"}
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
                  {language === "ar" ? "كيف يمكنني إنشاء مهمة جديدة؟" : "How can I create a new task?"}
                </p>
                <p className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
                  {language === "ar" ? "كيف أضيف حدثًا إلى التقويم؟" : "How do I add an event to my calendar?"}
                </p>
                <p className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded">
                  {language === "ar" ? "هل يمكنني تسجيل الملاحظات الصوتية؟" : "Can I record voice notes?"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
