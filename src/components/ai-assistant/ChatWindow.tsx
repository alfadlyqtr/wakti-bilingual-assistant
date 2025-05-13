
import React, { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChatMessage, AIMode } from "./types";
import { t } from "@/utils/translations";

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  activeMode: AIMode;
  getModeColor: (mode: AIMode) => string;
  onConfirm: (messageId: string, action: string) => void;
  messageEndRef: RefObject<HTMLDivElement>;
  language: string;
  theme: string;
}

export function ChatWindow({
  messages,
  isTyping,
  activeMode,
  getModeColor,
  onConfirm,
  messageEndRef,
  language,
  theme
}: ChatWindowProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-3xl mx-auto">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              className={cn(
                "mb-4 max-w-[80%]",
                message.role === "assistant" ? "mr-auto" : "ml-auto"
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div
                className={cn(
                  "p-3 rounded-2xl",
                  message.role === "assistant" ? 
                    "rounded-bl-none" : 
                    "rounded-br-none",
                  message.role === "assistant" ? 
                    "bg-muted text-muted-foreground" :
                    "bg-primary text-primary-foreground"
                )}
                style={{
                  backgroundColor: message.role === "assistant" ? 
                    getModeColor(message.mode) :
                    undefined,
                  color: message.role === "assistant" && 
                    (message.mode === "assistant" || 
                     (theme === "light" && message.mode === "general") ||
                     (theme === "dark" && message.mode === "writer")) ? 
                    "#ffffff" : 
                    undefined
                }}
              >
                <div className="prose dark:prose-invert">
                  {message.content}
                </div>
                
                {message.needsConfirmation && (
                  <div className="mt-3 pt-3 border-t border-opacity-20 border-black dark:border-white">
                    {message.needsConfirmation.type === "task" && (
                      <div className="bg-opacity-10 bg-black dark:bg-white p-3 rounded-md mb-3">
                        <div className="font-medium">{message.needsConfirmation.data.title}</div>
                        <div className="text-sm opacity-70">
                          {t("due", language)}: {new Date(message.needsConfirmation.data.dueDate).toLocaleDateString(
                            language === "ar" ? "ar-SA" : "en-US"
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full text-sm font-medium"
                        onClick={() => onConfirm(message.id, "cancel")}
                      >
                        {t("cancel", language)}
                      </button>
                      <button
                        className="px-4 py-1.5 bg-white bg-opacity-80 hover:bg-opacity-100 text-black rounded-full text-sm font-medium"
                        onClick={() => onConfirm(message.id, "confirm")}
                      >
                        {message.needsConfirmation.action === "switchMode" ? 
                          t("switchMode", language) : 
                          message.needsConfirmation.type === "task" ?
                            t("createTask", language) :
                            t("confirm", language)
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-1 px-2">
                {message.timestamp.toLocaleTimeString(
                  language === "ar" ? "ar-SA" : "en-US",
                  { hour: '2-digit', minute: '2-digit' }
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div
            className={cn(
              "mb-4 max-w-[80%] mr-auto"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              className="p-3 rounded-2xl rounded-bl-none bg-muted"
              style={{
                backgroundColor: getModeColor(activeMode),
                color: activeMode === "assistant" || 
                  (theme === "light" && activeMode === "general") ||
                  (theme === "dark" && activeMode === "writer") ? 
                  "#ffffff" : 
                  undefined
              }}
            >
              <div className="flex space-x-1">
                <motion.div 
                  className="w-2 h-2 rounded-full bg-current opacity-70"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                <motion.div 
                  className="w-2 h-2 rounded-full bg-current opacity-70"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, delay: 0.2, repeat: Infinity }}
                />
                <motion.div 
                  className="w-2 h-2 rounded-full bg-current opacity-70"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.2, delay: 0.4, repeat: Infinity }}
                />
              </div>
            </div>
          </motion.div>
        )}
        
        <div ref={messageEndRef} />
      </div>
    </div>
  );
}
