
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MessageSquare, History, Trash2 } from "lucide-react";
import { AIMode, ASSISTANT_MODES } from "./types";
import { toast } from "@/hooks/use-toast";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  language: string;
  activeMode: AIMode;
}

export function LeftDrawer({ isOpen, onClose, theme, language, activeMode }: LeftDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<any[]>([]); // Empty array instead of dummy data
  const direction = language === "ar" ? "rtl" : "ltr";
  const isDark = theme === "dark";
  
  // Get drawer background color based on active mode
  const getDrawerBgColor = (mode: AIMode) => {
    const modeData = ASSISTANT_MODES.find(m => m.id === mode);
    return isDark ? modeData?.color.dark : modeData?.color.light;
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

  // Get mode color for chat items
  const getModeColor = (mode: string) => {
    const modeData = ASSISTANT_MODES.find(m => m.id === mode);
    return isDark ? modeData?.color.dark : modeData?.color.light;
  };

  // Filter chats based on search query
  const filteredChats = searchQuery 
    ? chats.filter(chat => 
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : chats;

  // Handle clear history functionality
  const handleClearHistory = () => {
    setChats([]);
    toast({
      title: t("success" as TranslationKey, language),
      description: t("clearHistory" as TranslationKey, language),
    });
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
            className="fixed left-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden flex flex-col"
            style={{ 
              backgroundColor: drawerBgColor,
              color: textColor
            }}
            dir={direction}
            initial={{ x: language === "ar" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-4 border-b border-opacity-20" style={{ borderColor: textColor }}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold flex items-center gap-2" style={{ color: textColor }}>
                  <History size={18} />
                  {t("chatHistory" as TranslationKey, language)}
                </h2>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={onClose} 
                  className="h-8 w-8"
                  style={{ color: textColor }}
                >
                  <X size={18} />
                </Button>
              </div>
            </div>
            
            {/* Search Bar */}
            <div className="p-4 border-b border-opacity-20" style={{ borderColor: textColor }}>
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4"
                  style={{ color: textColor, opacity: 0.7 }}
                />
                <Input
                  className="pl-10 pr-4 py-2"
                  placeholder={t("searchChats" as TranslationKey, language)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: `${textColor}15`,
                    color: textColor,
                    borderColor: `${textColor}30`
                  }}
                />
              </div>
            </div>
            
            {/* Chat List - Always showing empty state now */}
            <div className="flex-1 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-8 text-center"
                style={{ color: `${textColor}80` }}
              >
                {searchQuery ? t("noChatsFound" as TranslationKey, language) : t("noChatsYet" as TranslationKey, language)}
              </motion.div>
            </div>
            
            {/* Bottom Button */}
            <div className="p-4 border-t border-opacity-20" style={{ borderColor: textColor }}>
              <Button
                variant="outline"
                className="w-full flex items-center gap-2 justify-center"
                style={{ 
                  borderColor: `${textColor}50`,
                  color: textColor,
                  backgroundColor: `${textColor}10`
                }}
                onClick={handleClearHistory}
              >
                <Trash2 size={16} />
                {t("clearHistory" as TranslationKey, language)}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
