
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, Settings, Menu, MessageSquare } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { ASSISTANT_MODES, AIMode, ChatMessage } from "./types";
import { ChatWindow } from "./ChatWindow";
import { ModeSelector } from "./ModeSelector";
import { LeftDrawer } from "./LeftDrawer";
import { RightDrawer } from "./RightDrawer";
import { VoiceInput } from "./VoiceInput";
import { v4 as uuidv4 } from "uuid";

export const AIAssistant = () => {
  const { theme, language } = useTheme();
  const [activeMode, setActiveMode] = useState<AIMode>("general");
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uuidv4(),
      role: "assistant",
      content: t("welcomeToWaktiAI" as TranslationKey, language),
      mode: "general",
      timestamp: new Date(),
      needsConfirmation: null
    }
  ]);
  
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Get color for the current mode
  const getModeColor = (mode: AIMode) => {
    const modeData = ASSISTANT_MODES.find(m => m.id === mode);
    return theme === "dark" ? modeData?.color.dark : modeData?.color.light;
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: input,
      mode: activeMode,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    
    // Simulate AI response
    setTimeout(() => {
      let aiResponse: ChatMessage;
      
      // Check for task creation request
      if (input.toLowerCase().includes("create task") || input.toLowerCase().includes("new task")) {
        if (activeMode !== "assistant") {
          // Need to switch mode
          aiResponse = {
            id: uuidv4(),
            role: "assistant",
            content: t("toCompleteThisAction" as TranslationKey, language) + " " + 
                    t("switchTo" as TranslationKey, language) + " " + 
                    t("assistantMode" as TranslationKey, language) + ".",
            mode: activeMode,
            timestamp: new Date(),
            needsConfirmation: {
              type: "mode",
              action: "switchMode",
              data: { targetMode: "assistant" }
            }
          };
        } else {
          // Create task in assistant mode
          aiResponse = {
            id: uuidv4(),
            role: "assistant",
            content: t("iCanCreateThisTask" as TranslationKey, language),
            mode: "assistant",
            timestamp: new Date(),
            needsConfirmation: {
              type: "task",
              action: "createTask",
              data: {
                title: input.replace(/create task|new task/i, "").trim(),
                dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                priority: "medium",
              }
            }
          };
        }
      } else {
        // Standard response
        aiResponse = {
          id: uuidv4(),
          role: "assistant",
          content: `${t("helpingYouWith" as TranslationKey, language)} "${input}" in ${t(`${activeMode}Mode` as TranslationKey, language)} mode.`,
          mode: activeMode,
          timestamp: new Date()
        };
      }
      
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const handleConfirmAction = (messageId: string, action: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.needsConfirmation) return;
    
    if (action === "confirm") {
      if (message.needsConfirmation.action === "switchMode" && message.needsConfirmation.data?.targetMode) {
        setActiveMode(message.needsConfirmation.data.targetMode as AIMode);
        
        // Follow up message after mode switch
        setTimeout(() => {
          const followUpMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: t("howCanIAssistYouWithWAKTI" as TranslationKey, language),
            mode: message.needsConfirmation.data.targetMode as AIMode,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, followUpMessage]);
        }, 500);
      }
      else if (message.needsConfirmation.action === "createTask") {
        // Task creation confirmation
        setTimeout(() => {
          const confirmationMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: t("taskCreatedSuccessfully" as TranslationKey, language),
            mode: "assistant",
            timestamp: new Date()
          };
          setMessages(prev => [...prev, confirmationMessage]);
        }, 500);
      }
    }
    
    // Remove confirmation UI regardless of action
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return { ...m, needsConfirmation: null };
      }
      return m;
    }));
  };

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript);
    setIsVoiceActive(false);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Left Drawer - Chat History */}
      <LeftDrawer 
        isOpen={isLeftDrawerOpen}
        onClose={() => setIsLeftDrawerOpen(false)}
        theme={theme}
        language={language}
      />
      
      {/* Right Drawer - Settings & Tools */}
      <RightDrawer
        isOpen={isRightDrawerOpen}
        onClose={() => setIsRightDrawerOpen(false)}
        activeMode={activeMode}
        language={language}
        theme={theme}
      />
      
      {/* Header with Title */}
      <header className="flex items-center justify-between px-4 py-3 border-b z-20 bg-background">
        <motion.button
          className="p-2 rounded-full hover:bg-accent"
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsLeftDrawerOpen(true)}
          aria-label={t("openHistory" as TranslationKey, language)}
        >
          <Menu size={20} />
        </motion.button>
        
        <h1 className="text-xl font-semibold">
          {t("waktiAssistant" as TranslationKey, language)}
        </h1>
        
        <motion.button
          className="p-2 rounded-full hover:bg-accent"
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsRightDrawerOpen(true)}
          aria-label={t("openSettings" as TranslationKey, language)}
        >
          <Settings size={20} />
        </motion.button>
      </header>
      
      {/* Mode Selector - Centered Pills */}
      <div className="px-4 py-3 flex justify-center border-b z-10">
        <ModeSelector 
          activeMode={activeMode} 
          setActiveMode={setActiveMode}
        />
      </div>
      
      {/* Main Chat Window */}
      <ChatWindow 
        messages={messages}
        isTyping={isTyping}
        activeMode={activeMode}
        getModeColor={getModeColor}
        onConfirm={handleConfirmAction}
        messageEndRef={messageEndRef}
        language={language}
        theme={theme}
      />
      
      {/* Bottom Input Area - Never covered by dock */}
      <div className="sticky bottom-24 left-0 right-0 z-30 px-4 pb-4 pt-2 border-t bg-background/95 backdrop-blur-md">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <VoiceInput 
            isActive={isVoiceActive} 
            onToggle={() => setIsVoiceActive(!isVoiceActive)}
            onTranscript={handleVoiceInput}
            language={language}
          />
          
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t("askWAKTI" as TranslationKey, language)}
              className="pl-4 pr-10 py-6 rounded-full"
            />
            
            <AnimatePresence>
              {input && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                >
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="rounded-full h-8 w-8" 
                    onClick={handleSendMessage}
                  >
                    <Send size={18} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
