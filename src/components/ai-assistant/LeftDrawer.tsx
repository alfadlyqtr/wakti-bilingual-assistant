
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MessageSquare, History, Trash2 } from "lucide-react";
import { AIMode } from "./types";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  language: string;
  activeMode: AIMode;
}

// Define drawer colors per mode
const DRAWER_COLORS = {
  general: "#858384",
  writer: "#fcfefd",
  creative: "#e9ceb0",
  assistant: "#0c0f14"
};

export function LeftDrawer({ isOpen, onClose, theme, language, activeMode }: LeftDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const direction = language === "ar" ? "rtl" : "ltr";
  const isDark = theme === "dark";
  
  // Get drawer background color based on active mode
  const drawerBgColor = DRAWER_COLORS[activeMode];
  
  // Get text color based on background for readability
  const getTextColor = (bgColor: string) => {
    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness >= 128 ? "#000000" : "#ffffff";
  };
  
  const textColor = getTextColor(drawerBgColor);
  
  // Mock previous chats
  const previousChats = [
    { id: "1", title: "Task Planning", date: new Date(), mode: "assistant" },
    { id: "2", title: "Image Creation", date: new Date(Date.now() - 86400000), mode: "creative" },
    { id: "3", title: "Meeting Notes", date: new Date(Date.now() - 172800000), mode: "writer" },
    { id: "4", title: "Translation Help", date: new Date(Date.now() - 259200000), mode: "general" },
    { id: "5", title: "Weekly Report", date: new Date(Date.now() - 345600000), mode: "writer" },
    { id: "6", title: "Event Planning", date: new Date(Date.now() - 432000000), mode: "assistant" },
    { id: "7", title: "Logo Design Ideas", date: new Date(Date.now() - 518400000), mode: "creative" }
  ];

  // Get mode color for chat items
  const getModeColor = (mode: string) => {
    switch (mode) {
      case "general":
        return "#858384";
      case "writer":
        return "#fcfefd";
      case "creative":
        return "#e9ceb0";
      case "assistant":
        return "#0c0f14";
      default:
        return undefined;
    }
  };

  // Filter chats based on search query
  const filteredChats = searchQuery 
    ? previousChats.filter(chat => 
        chat.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : previousChats;

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
            
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {filteredChats.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-4 py-8 text-center"
                    style={{ color: `${textColor}80` }}
                  >
                    {searchQuery ? t("noChatsFound" as TranslationKey, language) : t("noChatsYet" as TranslationKey, language)}
                  </motion.div>
                ) : (
                  filteredChats.map((chat, index) => (
                    <motion.div 
                      key={chat.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="px-4 py-3 hover:bg-opacity-10 cursor-pointer flex gap-3 items-center border-b border-opacity-10"
                      style={{ 
                        borderColor: textColor,
                        backgroundColor: 'transparent',
                        ':hover': { backgroundColor: `${textColor}10` }
                      }}
                    >
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ 
                          backgroundColor: getModeColor(chat.mode),
                          color: getTextColor(getModeColor(chat.mode))
                        }}
                      >
                        <MessageSquare size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ color: textColor }}>
                          {chat.title}
                        </div>
                        <div className="text-xs" style={{ color: `${textColor}80` }}>
                          {chat.date.toLocaleDateString(
                            language === "ar" ? "ar-SA" : "en-US",
                            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
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
                onClick={() => {
                  // Clear history functionality would go here
                }}
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
