
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MessageSquare, History } from "lucide-react";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  language: string;
}

export function LeftDrawer({ isOpen, onClose, theme, language }: LeftDrawerProps) {
  // Mock previous chats
  const previousChats = [
    { id: "1", title: "Task Planning", date: new Date(), mode: "assistant" },
    { id: "2", title: "Image Creation", date: new Date(Date.now() - 86400000), mode: "creative" },
    { id: "3", title: "Meeting Notes", date: new Date(Date.now() - 172800000), mode: "writer" },
    { id: "4", title: "Translation Help", date: new Date(Date.now() - 259200000), mode: "general" }
  ];

  // Get mode color for chat items
  const getModeColor = (mode: string) => {
    switch (mode) {
      case "general":
        return theme === "dark" ? "#858384" : "#060541";
      case "writer":
        return theme === "dark" ? "#fcfefd" : "#e9ceb0";
      case "creative":
        return theme === "dark" ? "#e9ceb0" : "#606062";
      case "assistant":
        return theme === "dark" ? "#0c0f14" : "#060541";
      default:
        return undefined;
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
            className="fixed left-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden bg-background border-r flex flex-col"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <History size={18} />
                {t("openHistory" as TranslationKey, language)}
              </h2>
              <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
                <X size={18} />
              </Button>
            </div>
            
            {/* Search Bar */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                />
                <Input
                  className="pl-10 pr-4 py-2"
                  placeholder={t("searchChats" as TranslationKey, language)}
                />
              </div>
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {previousChats.map((chat, index) => (
                  <motion.div 
                    key={chat.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="px-4 py-3 hover:bg-accent cursor-pointer flex gap-3 items-center border-b border-muted"
                  >
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: getModeColor(chat.mode) }}
                    >
                      <MessageSquare size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{chat.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {chat.date.toLocaleDateString(
                          language === "ar" ? "ar-SA" : "en-US",
                          { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {previousChats.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  {t("noChatsYet" as TranslationKey, language)}
                </div>
              )}
            </div>
            
            {/* Bottom Button */}
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // Clear history functionality would go here
                }}
              >
                {t("clearHistory" as TranslationKey, language)}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
