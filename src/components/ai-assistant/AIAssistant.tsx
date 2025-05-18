
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LeftDrawer } from "./LeftDrawer";
import { RightDrawer } from "./RightDrawer";
import ChatWindow from "./ChatWindow";
import { ChatInput } from "./ChatInput";
import { ModeSelector } from "./ModeSelector";
import { AIMode } from "./types";
import { useTheme } from "@/providers/ThemeProvider";
import { ASSISTANT_MODES } from "./types";
import { useChatHistory } from "./hooks/useChatHistory";
import { useChatActions } from "./hooks/useChatActions";
import { useActionConfirmations } from "./hooks/useActionConfirmations";
import { modeController } from "@/utils/modeController";

export const AIAssistant: React.FC = () => {
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>("general");
  const [isSending, setIsSending] = useState(false);

  const { user } = useAuth();
  
  // Get language and theme from ThemeProvider
  const { theme, language } = useTheme();
  const currentTheme = theme || "light";

  // Use custom hooks for chat functionality
  const { messages, setMessages } = useChatHistory(user?.id || null);
  
  const {
    processUserMessage,
    handleDirectImageGeneration,
    handleImageGeneration,
    getModeName,
    useDirectImageGeneration,
    pendingModeSwitchMessage,
    setPendingModeSwitchMessage,
    pendingModeSwitchTarget,
    setPendingModeSwitchTarget
  } = useChatActions(
    messages, 
    setMessages, 
    activeMode, 
    isTyping, 
    setIsTyping, 
    isSending, 
    setIsSending
  );
  
  const { handleConfirmAction } = useActionConfirmations(
    messages,
    setMessages,
    activeMode,
    processUserMessage,
    handleDirectImageGeneration,
    handleImageGeneration,
    pendingModeSwitchMessage,
    setPendingModeSwitchMessage,
    pendingModeSwitchTarget,
    setPendingModeSwitchTarget
  );

  // Register with mode controller
  useEffect(() => {
    modeController.registerCallbacks({
      onAfterChange: (oldMode, newMode) => {
        setActiveMode(newMode);
      }
    });
    
    return () => {
      // Cleanup
      modeController.unregisterCallbacks();
    };
  }, []);

  // Handle voice transcription
  const handleVoiceTranscription = (text: string) => {
    if (text && text.trim()) {
      setInputValue(text);
      // Process the voice transcription automatically
      setTimeout(() => {
        processUserMessage(text);
      }, 300);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputValue.trim() || !user) return;
    await processUserMessage(inputValue);
    setInputValue("");
  };

  // Function to handle mode changes
  const handleModeChange = async (newMode: AIMode) => {
    if (newMode === activeMode) return;
    await modeController.setActiveMode(newMode);
  };

  // Function to get the color based on mode
  const getModeColor = (mode: AIMode): string => {
    const modeData = ASSISTANT_MODES.find((m) => m.id === mode);
    const colorKey = currentTheme === "dark" ? "dark" : "light";
    return modeData?.color[colorKey] || "#3498db";
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex flex-col flex-1 relative overflow-hidden"
        style={{ backgroundColor: currentTheme === "dark" ? "#0c0f14" : "#fcfefd" }}
      >
        {/* Left Drawer */}
        <LeftDrawer
          isOpen={isLeftDrawerOpen}
          onClose={() => setIsLeftDrawerOpen(false)}
          activeMode={activeMode} 
          language={language}
        />

        {/* Mode Selector */}
        <ModeSelector
          activeMode={activeMode}
          setActiveMode={handleModeChange}
          language={language as "en" | "ar"}
        />

        {/* Chat Window */}
        <ChatWindow
          messages={messages}
          isTyping={isTyping}
          activeMode={activeMode}
          getModeColor={getModeColor}
          onConfirm={handleConfirmAction}
          language={language}
          theme={currentTheme}
          setActiveMode={setActiveMode}
        />

        {/* Chat Input */}
        <ChatInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSendMessage={handleSendMessage}
          handleVoiceTranscription={handleVoiceTranscription}
          isSending={isSending}
          isTyping={isTyping}
          user={user}
          onOpenLeftDrawer={() => setIsLeftDrawerOpen(true)}
          onOpenRightDrawer={() => setIsRightDrawerOpen(true)}
          language={language}
          theme={currentTheme}
        />

        {/* Right Drawer */}
        <RightDrawer
          isOpen={isRightDrawerOpen}
          onClose={() => setIsRightDrawerOpen(false)}
          activeMode={activeMode}
          language={language}
        />
      </div>
    </div>
  );
};

export default AIAssistant;
