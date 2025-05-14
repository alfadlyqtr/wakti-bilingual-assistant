import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mic, Send, Settings, Menu, MessageSquare } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { ASSISTANT_MODES, AIMode, ChatMessage, MODE_INTENTS, MODE_NAME_MAP } from "./types";
import { ChatWindow } from "./ChatWindow";
import { ModeSelector } from "./ModeSelector";
import { LeftDrawer } from "./LeftDrawer";
import { RightDrawer } from "./RightDrawer";
import { VoiceInput } from "./VoiceInput";
import { MobileHeader } from "@/components/MobileHeader";
import { v4 as uuidv4 } from "uuid";
import { UserMenu } from "@/components/UserMenu";
import { toast } from "@/hooks/use-toast";

export const AIAssistant = () => {
  const { theme, language } = useTheme();
  const [activeMode, setActiveMode] = useState<AIMode>("general");
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    input: string;
    targetMode: AIMode;
  } | null>(null);
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

  // Detect intent and suggest mode switch if needed
  const detectIntent = (userInput: string): AIMode | null => {
    userInput = userInput.toLowerCase();
    
    // Skip intent detection for very short inputs
    if (userInput.length < 5) return null;
    
    // Check each mode's intent patterns
    for (const [modeType, patterns] of Object.entries(MODE_INTENTS)) {
      // Skip if this is the current mode type
      if (modeType === activeMode) continue;
      
      // Check if the input matches any pattern for this mode
      const matchesMode = patterns.some(pattern => 
        userInput.includes(pattern)
      );
      
      if (matchesMode) {
        return modeType as AIMode;
      }
    }
    
    return null; // No mode switch needed
  };

  // Step 1: Handle initial user message and detect if mode switch is needed
  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    // Add user message immediately
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: input,
      mode: activeMode,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Check if we should suggest a mode switch
    const suggestedMode = detectIntent(input);
    setIsTyping(true);
    
    setTimeout(() => {
      if (suggestedMode) {
        // Step 1: Suggest mode switch with confirmation buttons
        const modeName = MODE_NAME_MAP[suggestedMode];
        
        const suggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `${t("youAskedTo" as TranslationKey, language)}: "${input}"\n\n${t("thisActionWorksBetterIn" as TranslationKey, language)} ${modeName}. ${t("wantToSwitch" as TranslationKey, language)}`,
          mode: activeMode,
          timestamp: new Date(),
          originalInput: input,
          actionButtons: {
            primary: {
              text: `${t("switchMode" as TranslationKey, language)} → ${modeName}`,
              action: `switch:${suggestedMode}`
            },
            secondary: {
              text: t("cancel" as TranslationKey, language),
              action: "cancel"
            }
          }
        };
        
        setMessages(prev => [...prev, suggestionMessage]);
      } else {
        // Regular message flow - no mode switch needed
        processMessageInCurrentMode(input);
      }
      
      setIsTyping(false);
      setInput("");
    }, 800);
  };

  // Process the message in the current mode (no switch needed)
  const processMessageInCurrentMode = (messageText: string) => {
    // Standard response
    const aiResponse: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: `${t("helpingYouWith" as TranslationKey, language)} "${messageText}" in ${t(activeMode as TranslationKey, language)}.`,
      mode: activeMode,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, aiResponse]);
  };

  // Step 2: Handle mode switch confirmation
  const handleActionButton = (messageId: string, action: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    // Check if this is a mode switch action
    if (action.startsWith("switch:")) {
      const targetMode = action.split(":")[1] as AIMode;
      const originalInput = message.originalInput || "";
      
      // Switch the mode
      setActiveMode(targetMode);
      
      // Store the pending action for confirmation in step 3
      setPendingAction({
        input: originalInput,
        targetMode
      });
      
      // Step 2: After user clicks Switch
      setTimeout(() => {
        const confirmationMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `${t("wereNowIn" as TranslationKey, language)} ${t(targetMode as TranslationKey, language)}.\n\n${t("stillWantMeToDoThis" as TranslationKey, language)}: "${originalInput}"`,
          mode: targetMode,
          timestamp: new Date(),
          actionButtons: {
            primary: {
              text: t("yesDoIt" as TranslationKey, language),
              action: `execute:${originalInput}`
            },
            secondary: {
              text: t("no" as TranslationKey, language),
              action: "cancel-execution"
            }
          }
        };
        
        setMessages(prev => [...prev, confirmationMessage]);
      }, 500);
    } 
    // Step 3: Execute the original input in the new mode
    else if (action.startsWith("execute:")) {
      const inputToExecute = action.split(":").slice(1).join(":");
      
      // Clear pending action
      setPendingAction(null);
      
      // Add user message showing the original input
      const userMessage: ChatMessage = {
        id: uuidv4(),
        role: "user",
        content: inputToExecute,
        mode: activeMode,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsTyping(true);
      
      // Process the message in the current (new) mode
      setTimeout(() => {
        processMessageInCurrentMode(inputToExecute);
        setIsTyping(false);
      }, 800);
    }
    // Cancel execution
    else if (action === "cancel-execution") {
      // Clear pending action
      setPendingAction(null);
      
      // Add a simple acknowledgment
      const ackMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: t("howCanIAssistYouWithWAKTI" as TranslationKey, language),
        mode: activeMode,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, ackMessage]);
    }
    
    // Remove action buttons from the message
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, actionButtons: undefined } : m
    ));
  };

  const handleVoiceInput = (transcript: string) => {
    setInput(transcript);
    setIsVoiceActive(false);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Main WAKTI App Header */}
      <div className="main-header sticky top-0 z-30 shadow-sm bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <img 
              src="/lovable-uploads/a1b03773-fb9b-441e-8b2d-c8559acaa23b.png" 
              alt="WAKTI Logo" 
              className="h-8 w-8 mr-2 cursor-pointer rounded-md"
            />
            <h1 className="text-lg font-semibold">WAKTI</h1>
          </div>
          <UserMenu />
        </div>
      </div>
      
      {/* Combined Mode Selector with Drawer Triggers - Single Row */}
      <div className="flex items-center justify-between px-4 py-3 border-b z-20">
        <motion.button
          className="p-2 rounded-full hover:bg-accent"
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsLeftDrawerOpen(true)}
          aria-label={t("openHistory" as TranslationKey, language)}
        >
          <Menu size={20} />
        </motion.button>
        
        <div className="flex-1">
          <ModeSelector 
            activeMode={activeMode} 
            setActiveMode={setActiveMode}
          />
        </div>
        
        <motion.button
          className="p-2 rounded-full hover:bg-accent"
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsRightDrawerOpen(true)}
          aria-label={t("openSettings" as TranslationKey, language)}
        >
          <Settings size={20} />
        </motion.button>
      </div>
      
      {/* Left Drawer - Chat History */}
      <LeftDrawer 
        isOpen={isLeftDrawerOpen}
        onClose={() => setIsLeftDrawerOpen(false)}
        theme={theme}
        language={language}
        activeMode={activeMode}
      />
      
      {/* Right Drawer - Settings & Tools */}
      <RightDrawer
        isOpen={isRightDrawerOpen}
        onClose={() => setIsRightDrawerOpen(false)}
        activeMode={activeMode}
        language={language}
        theme={theme}
      />
      
      {/* Main Chat Window */}
      <ChatWindow 
        messages={messages}
        isTyping={isTyping}
        activeMode={activeMode}
        getModeColor={getModeColor}
        onConfirm={handleActionButton}
        messageEndRef={messageEndRef}
        language={language}
        theme={theme}
      />
      
      {/* Bottom Input Area - Never covered by dock */}
      <div className="sticky bottom-24 left-0 right-0 z-30 px-4 pb-4 pt-2 border-t bg-background/95 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <VoiceInput 
            isActive={isVoiceActive} 
            onToggle={() => setIsVoiceActive(!isVoiceActive)}
            onTranscript={handleVoiceInput}
            language={language}
            activeMode={activeMode}
          />
          
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={t("askWAKTI" as TranslationKey, language)}
              className={`pl-4 pr-10 py-6 rounded-full shadow-sm transition-all duration-300`}
              style={{
                borderColor: getModeColor(activeMode),
                boxShadow: `0 0 8px ${getModeColor(activeMode)}30`
              }}
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
