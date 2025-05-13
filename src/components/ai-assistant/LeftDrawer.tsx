
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { t } from "@/utils/translations";

interface LeftDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme: string;
  language: string;
}

export function LeftDrawer({ isOpen, onClose, theme, language }: LeftDrawerProps) {
  // Mock previous chats
  const previousChats = [
    { id: "1", title: "Task Planning", date: new Date() },
    { id: "2", title: "Image Creation", date: new Date(Date.now() - 86400000) },
    { id: "3", title: "Meeting Notes", date: new Date(Date.now() - 172800000) }
  ];

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
            className={cn(
              "fixed left-0 top-0 h-full w-4/5 max-w-xs z-50 overflow-hidden",
              "flex flex-col"
            )}
            style={{ 
              backgroundColor: theme === "dark" ? "#606062" : "#e9ceb0",
              color: theme === "dark" ? "#ffffff" : "#000000"
            }}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
          >
            {/* Search Bar */}
            <div className="p-4 border-b border-black/10 dark:border-white/10">
              <div className="relative">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 opacity-50"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-black/10 dark:bg-white/10 placeholder:text-black/50 dark:placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 dark:focus:ring-black/20"
                  placeholder={t("searchChats", language)}
                  style={{ 
                    color: theme === "dark" ? "#ffffff" : "#000000" 
                  }}
                />
              </div>
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              <div className="py-2">
                {previousChats.map(chat => (
                  <div 
                    key={chat.id}
                    className="px-4 py-3 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <div className="font-medium truncate">{chat.title}</div>
                    <div className="text-xs opacity-70">
                      {chat.date.toLocaleDateString(
                        language === "ar" ? "ar-SA" : "en-US",
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                      )}
                    </div>
                  </div>
                ))}
                {previousChats.length === 0 && (
                  <div className="px-4 py-8 text-center opacity-70">
                    {t("noChatsYet", language)}
                  </div>
                )}
              </div>
            </div>
            
            {/* Bottom Buttons */}
            <div className="p-4 border-t border-black/10 dark:border-white/10">
              <button
                className="w-full py-2 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 font-medium"
              >
                {t("clearHistory", language)}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
