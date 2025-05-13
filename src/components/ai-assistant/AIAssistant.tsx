
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { cn } from "@/lib/utils";
import { ModePanel } from "./ModePanel";
import { ChatWindow } from "./ChatWindow";
import { RightPanel } from "./RightPanel";
import { LeftDrawer } from "./LeftDrawer";
import { VoiceInput } from "./VoiceInput";
import { AssistantMode, ChatMessage, AIMode } from "./types";
import { TranslationKey } from "@/utils/translationTypes";

export function AIAssistant() {
  const { language, theme } = useTheme();
  const [activeMode, setActiveMode] = useState<AIMode>("general");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: t("welcomeToWaktiAI" as TranslationKey, language),
      mode: "general",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState<{ type: string; data: any } | null>(null);
  
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Colors based on mode and theme
  const getModeColor = (mode: AIMode) => {
    if (theme === "dark") {
      switch (mode) {
        case "general": return "#858384";
        case "writer": return "#fcfefd";
        case "creative": return "#e9ceb0";
        case "assistant": return "#0c0f14";
        default: return "#858384";
      }
    } else {
      switch (mode) {
        case "general": return "#060541";
        case "writer": return "#e9ceb0";
        case "creative": return "#606062";
        case "assistant": return "#060541";
        default: return "#060541";
      }
    }
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-mode detection based on user input
  const detectMode = (text: string): AIMode | null => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes("create task") || 
        lowerText.includes("reminder") || 
        lowerText.includes("event") || 
        lowerText.includes("calendar")) {
      return "assistant";
    }
    
    if (lowerText.includes("image") || 
        lowerText.includes("chart") || 
        lowerText.includes("generate") || 
        lowerText.includes("picture")) {
      return "creative";
    }
    
    if (lowerText.includes("write") || 
        lowerText.includes("email") || 
        lowerText.includes("text") || 
        lowerText.includes("letter") ||
        lowerText.includes("draft")) {
      return "writer";
    }
    
    return null;
  };

  const handleModeChange = (mode: AIMode) => {
    setActiveMode(mode);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  };

  const handleVoiceInput = (transcript: string) => {
    setInputText(transcript);
    setIsVoiceActive(false);
  };

  const handleToggleVoice = () => {
    setIsVoiceActive(!isVoiceActive);
  };

  const processInput = async () => {
    if (!inputText.trim()) return;
    
    // Detect if we should switch modes
    const detectedMode = detectMode(inputText);
    
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputText,
      mode: activeMode,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);
    
    // If detected mode is different, suggest mode switch
    if (detectedMode && detectedMode !== activeMode) {
      setTimeout(() => {
        const switchMessage: ChatMessage = {
          id: `switch-${Date.now()}`,
          role: "assistant",
          content: `${t("toCompleteThisAction" as TranslationKey, language)} ${t("switchTo" as TranslationKey, language)} ${t((detectedMode + "Mode") as TranslationKey, language)}. ${t("hereIsWhatIUnderstood" as TranslationKey, language)}...`,
          mode: activeMode,
          timestamp: new Date(),
          needsConfirmation: {
            type: detectedMode,
            action: "switchMode",
            data: { targetMode: detectedMode }
          }
        };
        
        setMessages((prev) => [...prev, switchMessage]);
        setIsTyping(false);
      }, 1000);
      
      return;
    }
    
    // Process message based on current mode
    try {
      let responseContent = "";
      let confirmationData = null;
      
      switch (activeMode) {
        case "assistant":
          // Here we would process task/event/reminder creation
          if (inputText.toLowerCase().includes("task")) {
            confirmationData = {
              type: "task",
              action: "create",
              data: {
                title: inputText.replace(/create task|task/i, "").trim(),
                dueDate: new Date(Date.now() + 86400000) // tomorrow
              }
            };
            responseContent = `${t("iCanCreateThisTask" as TranslationKey, language)}:`;
          } else {
            responseContent = t("howCanIAssistYouWithWAKTI" as TranslationKey, language);
          }
          break;
          
        case "creative":
          responseContent = t("generatingVisualContent" as TranslationKey, language);
          // In a real implementation, we would call the image generation API
          break;
          
        case "writer":
          responseContent = t("writingContent" as TranslationKey, language);
          // In a real implementation, we would call the text generation API
          break;
          
        default: // general
          responseContent = `${t("helpingYouWith" as TranslationKey, language)}: ${inputText}`;
          // In a real implementation, we would call the LLM API
      }
      
      // Add AI response after a short delay
      setTimeout(() => {
        const aiMessage: ChatMessage = {
          id: `response-${Date.now()}`,
          role: "assistant",
          content: responseContent,
          mode: activeMode,
          timestamp: new Date(),
          needsConfirmation: confirmationData
        };
        
        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);
      }, 1500);
      
    } catch (error) {
      console.error("Error processing message:", error);
      setIsTyping(false);
      
      // Add error message
      setMessages((prev) => [
        ...prev, 
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: t("errorProcessingRequest" as TranslationKey, language),
          mode: activeMode,
          timestamp: new Date(),
        }
      ]);
    }
  };

  const handleSendMessage = () => {
    processInput();
  };

  const handleConfirmAction = (messageId: string, action: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (!message || !message.needsConfirmation) return;
    
    if (action === "confirm") {
      // Handle the specific action based on the confirmation type
      if (message.needsConfirmation.action === "switchMode" && message.needsConfirmation.data?.targetMode) {
        setActiveMode(message.needsConfirmation.data.targetMode as AIMode);
      } else if (message.needsConfirmation.action === "create" && message.needsConfirmation.type === "task") {
        // In a real implementation, we would create the task
        setMessages((prev) => [
          ...prev,
          {
            id: `confirm-${Date.now()}`,
            role: "assistant",
            content: t("taskCreatedSuccessfully" as TranslationKey, language),
            mode: activeMode,
            timestamp: new Date(),
          }
        ]);
      }
    }
    
    // Mark the message as handled
    setMessages((prev) => 
      prev.map(msg => 
        msg.id === messageId ? 
          {...msg, needsConfirmation: null} : 
          msg
      )
    );
  };

  return (
    <div className="fixed inset-0 flex flex-col h-full w-full overflow-hidden"
         style={{
           backgroundColor: theme === "dark" ? "#0c0f14" : "#fcfefd",
         }}>
      {/* Top Mode Selector */}
      <ModePanel 
        activeMode={activeMode} 
        onModeChange={handleModeChange}
      />
      
      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Drawer - Chat History */}
        <LeftDrawer 
          isOpen={isLeftDrawerOpen}
          onClose={() => setIsLeftDrawerOpen(false)}
          theme={theme}
          language={language}
        />
        
        {/* Chat Window */}
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
        
        {/* Right Gear Panel */}
        <RightPanel 
          isOpen={isRightPanelOpen}
          onClose={() => setIsRightPanelOpen(false)}
          activeMode={activeMode}
          language={language}
          theme={theme}
        />
      </div>
      
      {/* Bottom Input Area */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-background">
        <div className="flex items-center gap-2">
          {/* Left Drawer Button */}
          <button
            onClick={() => setIsLeftDrawerOpen(true)}
            className="p-2 rounded-full hover:bg-accent"
            aria-label={t("openHistory" as TranslationKey, language)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-menu">
              <line x1="4" x2="20" y1="12" y2="12"/>
              <line x1="4" x2="20" y1="6" y2="6"/>
              <line x1="4" x2="20" y1="18" y2="18"/>
            </svg>
          </button>
          
          {/* Text Input */}
          <input
            type="text"
            className="flex-1 px-4 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t("askWAKTI" as TranslationKey, language)}
            value={inputText}
            onChange={handleInputChange}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          
          {/* Voice Input Button */}
          <VoiceInput 
            isActive={isVoiceActive} 
            onToggle={handleToggleVoice}
            onTranscript={handleVoiceInput}
            language={language}
          />
          
          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            className={cn(
              "p-2 rounded-full",
              inputText.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            disabled={!inputText.trim()}
            aria-label={t("send" as TranslationKey, language)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-send">
              <path d="m22 2-7 20-4-9-9-4Z"/>
              <path d="M22 2 11 13"/>
            </svg>
          </button>
          
          {/* Right Panel Button */}
          <button
            onClick={() => setIsRightPanelOpen(true)}
            className="p-2 rounded-full hover:bg-accent"
            aria-label={t("openSettings" as TranslationKey, language)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
