
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, MessageSquare, History, Trash2 } from "lucide-react";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  language: string;
}

export function LeftDrawer({ isOpen, onClose, theme, language }: LeftDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const direction = language === "ar" ? "rtl" : "ltr";
  const isDark = theme === "dark";
  
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
            className="fixed left-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden bg-background border-r flex flex-col"
            dir={direction}
            initial={{ x: language === "ar" ? "100%" : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: language === "ar" ? "100%" : "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2">
                <History size={18} />
                {t("chatHistory" as TranslationKey, language)}
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
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                    className="px-4 py-8 text-center text-muted-foreground"
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
                      className="px-4 py-3 hover:bg-accent/50 cursor-pointer flex gap-3 items-center border-b border-muted"
                    >
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-background shrink-0"
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
                  ))
                )}
              </AnimatePresence>
            </div>
            
            {/* Bottom Button */}
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full flex items-center gap-2 justify-center"
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
