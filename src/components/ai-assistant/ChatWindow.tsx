
import React, { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChatMessage, AIMode } from "./types";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Check, X, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { arSA } from "date-fns/locale";

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  activeMode: AIMode;
  getModeColor: (mode: AIMode) => string | undefined;
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
  const direction = language === "ar" ? "rtl" : "ltr";
  
  return (
    <div 
      className="flex-1 overflow-y-auto p-4 pb-6" 
      style={{ direction }}
    >
      <div className="max-w-3xl mx-auto">
        <AnimatePresence>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              className={cn(
                "mb-4 max-w-[85%]",
                message.role === "assistant" ? 
                  language === "ar" ? "ml-auto" : "mr-auto" : 
                  language === "ar" ? "mr-auto" : "ml-auto"
              )}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.3,
                delay: 0.1 * Math.min(index, 3) // Cap the delay for older messages
              }}
            >
              <div className={`flex items-start gap-2 ${language === "ar" ? "flex-row-reverse" : ""}`}>
                {message.role === "assistant" && (
                  <Avatar className="mt-1 border-2" style={{ borderColor: getModeColor(message.mode) }}>
                    <AvatarImage src="/wakti-logo-square.png" alt="WAKTI AI" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                
                <div className="flex flex-col gap-1">
                  <motion.div
                    className={cn(
                      "p-3 rounded-2xl shadow-sm",
                      message.role === "assistant" ? 
                        language === "ar" ? "rounded-tr-none" : "rounded-tl-none" : 
                        language === "ar" ? "rounded-tl-none" : "rounded-tr-none",
                      message.role === "assistant" ? 
                        "bg-secondary text-secondary-foreground" : 
                        "bg-primary text-primary-foreground"
                    )}
                    style={{
                      backgroundColor: message.role === "assistant" ? 
                        getModeColor(message.mode) : undefined
                    }}
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className={`prose prose-sm ${theme === "dark" ? "dark:prose-invert" : ""}`}>
                      {message.content}
                    </div>
                    
                    {/* Confirmation UI for actions */}
                    <AnimatePresence>
                      {message.needsConfirmation && (
                        <motion.div 
                          className="mt-3 pt-3 border-t border-opacity-20 border-black dark:border-white"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {message.needsConfirmation.type === "task" && message.needsConfirmation.data && (
                            <motion.div 
                              className="bg-opacity-10 bg-black dark:bg-white p-3 rounded-md mb-3"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 }}
                            >
                              <div className="font-medium">{message.needsConfirmation.data.title}</div>
                              <div className="text-sm opacity-70 flex items-center gap-1 mt-1">
                                <Calendar size={14} />
                                {format(
                                  new Date(message.needsConfirmation.data.dueDate), 
                                  "PPP", 
                                  { locale: language === "ar" ? arSA : undefined }
                                )}
                                <Clock size={14} className="ml-2 mr-1" />
                                {format(
                                  new Date(message.needsConfirmation.data.dueDate),
                                  "p",
                                  { locale: language === "ar" ? arSA : undefined }
                                )}
                              </div>
                              <div className="text-sm mt-1 flex items-center gap-1">
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-black/20 dark:bg-white/20">
                                  {message.needsConfirmation.data.priority}
                                </span>
                              </div>
                            </motion.div>
                          )}
                          
                          <div className="flex gap-2 mt-2 justify-end">
                            <motion.button
                              className="px-4 py-1.5 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 rounded-full text-sm font-medium transition-all flex items-center gap-1"
                              onClick={() => onConfirm(message.id, "cancel")}
                              whileTap={{ scale: 0.95 }}
                            >
                              <X size={14} />
                              {t("cancel" as TranslationKey, language)}
                            </motion.button>
                            
                            <motion.button
                              className="px-4 py-1.5 bg-white dark:bg-black text-black dark:text-white rounded-full text-sm font-medium transition-all flex items-center gap-1"
                              onClick={() => onConfirm(message.id, "confirm")}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Check size={14} />
                              {message.needsConfirmation.action === "switchMode" ? 
                                t("switchMode" as TranslationKey, language) : 
                                message.needsConfirmation.type === "task" ?
                                  t("createTask" as TranslationKey, language) :
                                  t("confirm" as TranslationKey, language)
                              }
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  
                  <div className={`text-xs text-muted-foreground px-1 ${language === "ar" ? "text-right" : "text-left"}`}>
                    {format(
                      message.timestamp,
                      "p",
                      { locale: language === "ar" ? arSA : undefined }
                    )}
                  </div>
                </div>
                
                {message.role === "user" && (
                  <Avatar className="mt-1">
                    <AvatarImage src="/user-avatar.png" alt="User" />
                    <AvatarFallback><User size={16} /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              className={cn(
                "mb-4 max-w-[85%]",
                language === "ar" ? "ml-auto" : "mr-auto"
              )}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`flex items-start gap-2 ${language === "ar" ? "flex-row-reverse" : ""}`}>
                <Avatar className="mt-1 border-2" style={{ borderColor: getModeColor(activeMode) }}>
                  <AvatarImage src="/wakti-logo-square.png" alt="WAKTI AI" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
                
                <motion.div
                  className={cn(
                    "p-3 rounded-2xl",
                    language === "ar" ? "rounded-tr-none" : "rounded-tl-none"
                  )}
                  style={{
                    backgroundColor: getModeColor(activeMode)
                  }}
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                >
                  <div className="flex space-x-1 h-5 items-center">
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
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div ref={messageEndRef} />
      </div>
    </div>
  );
}
