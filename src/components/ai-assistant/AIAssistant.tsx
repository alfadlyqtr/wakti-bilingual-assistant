
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { LeftDrawer } from "./LeftDrawer";
import { RightDrawer } from "./RightDrawer";
import { ChatWindow } from "./ChatWindow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "./VoiceInput";
import {
  Menu,
  Send,
  Image as ImageIcon,
  Calculator,
  PlusCircle,
  Loader2,
  Settings,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { AIMode, ChatMessage, ASSISTANT_MODES } from "./types";
import { ModeSelector } from "./ModeSelector";
import { v4 as uuidv4 } from "uuid";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import {
  saveChatMessage,
  getRecentChatHistory,
  processAIRequest,
  generateImage,
  isImageGenerationRequest,
  extractImagePrompt,
  detectAppropriateMode
} from "@/services/chatService";

// Changed this function to accept language as a parameter
const getDefaultWelcomeMessage = (language: "en" | "ar"): string => {
  return language === "ar"
    ? "مرحبًا! أنا وكتي، مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟"
    : "Hello! I'm WAKTI, your smart assistant. How can I help you today?";
};

export const AIAssistant: React.FC = () => {
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeMode, setActiveMode] = useState<AIMode>("general");
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [pendingModeSwitchMessage, setPendingModeSwitchMessage] = useState<string | null>(null);
  const [pendingModeSwitchTarget, setPendingModeSwitchTarget] = useState<AIMode | null>(null);

  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useIsMobile();
  const { theme } = useTheme();
  const { user, session } = useAuth();
  const { showSuccess, showError, showInfo } = useToastHelper();

  // Language and theme state - Changed this to typed string literal
  const language = "en" as "en" | "ar"; // This would normally come from user preferences
  const currentTheme = theme || "light";

  // Set initial welcome message or load chat history
  useEffect(() => {
    const initializeChat = async () => {
      if (user && !historyLoaded) {
        console.log("Initializing chat with user:", user.id);
        await loadChatHistory();
        setHistoryLoaded(true);
      } else if (!user && !historyLoaded) {
        console.log("Setting welcome message for anonymous user");
        const welcomeMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: getDefaultWelcomeMessage(language),
          timestamp: new Date(),
          mode: "general",
        };
        setMessages([welcomeMessage]);
        setHistoryLoaded(true);
      }
    };

    initializeChat();
  }, [user, language]);

  // Re-initialize chat when user logs in/out
  useEffect(() => {
    if (user === null && historyLoaded) {
      // User logged out, reset to welcome message
      setHistoryLoaded(false);
      setMessages([]);
    }
  }, [user]);

  // Load chat history from Supabase
  const loadChatHistory = async () => {
    if (!user) return;

    try {
      console.log("Loading chat history for user:", user.id);
      const history = await getRecentChatHistory(user.id, null, 20);
      
      if (history.length > 0) {
        console.log(`Loaded ${history.length} chat messages from history`);
        // Only set history if it's not empty
        // We're not replacing the welcome message if there's no history
        setMessages(history);
      } else {
        // If no history, show welcome message
        console.log("No chat history found, showing welcome message");
        const welcomeMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: getDefaultWelcomeMessage(language),
          timestamp: new Date(),
          mode: "general",
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error("Error fetching chat history:", error);
      // We'll just keep the welcome message if history fetching fails
      const welcomeMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: getDefaultWelcomeMessage(language),
        timestamp: new Date(),
        mode: "general",
      };
      setMessages([welcomeMessage]);
    }
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Handle mode switching with double echo logic
  const handleModeSwitch = useCallback(async (messageId: string, action: string) => {
    if (action.startsWith("switch_to_") && user) {
      const newMode = action.replace("switch_to_", "") as AIMode;
      console.log(`Switching mode from ${activeMode} to ${newMode}`);
      
      // Store the pending message and target mode
      const pendingMessage = pendingModeSwitchMessage || inputValue;
      
      // Switch the mode
      setActiveMode(newMode);
      
      // Add confirmation message
      const confirmMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `Still want me to do this: "${pendingMessage}"?`,
        timestamp: new Date(),
        mode: newMode,
        actionButtons: {
          primary: {
            text: "Yes, do it",
            action: "execute_pending",
          },
          secondary: {
            text: "No, cancel",
            action: "cancel_pending",
          },
        }
      };
      
      setMessages((prev) => [...prev, confirmMessage]);
      setPendingModeSwitchMessage(pendingMessage);
      setPendingModeSwitchTarget(newMode);
      
      // Save the confirmation message
      await saveChatMessage(user.id, confirmMessage.content, "assistant", newMode, {
        pendingMessage,
        actionButtons: confirmMessage.actionButtons
      });
      
    } else if (action === "execute_pending" && pendingModeSwitchMessage && user) {
      // Execute the pending message in the new mode
      console.log("Executing pending message after mode switch:", pendingModeSwitchMessage);
      
      // Clear pending state first to avoid loops
      const messageToSend = pendingModeSwitchMessage;
      setPendingModeSwitchMessage(null);
      setPendingModeSwitchTarget(null);
      
      // Process the message in the new mode
      await processUserMessage(messageToSend);
      
    } else if (action === "cancel_pending") {
      // Clear pending state
      setPendingModeSwitchMessage(null);
      setPendingModeSwitchTarget(null);
      console.log("Cancelled pending action after mode switch");
      
    } else {
      // Handle other action types (task creation, reminder, event, etc.)
      handleConfirmAction(messageId, action);
    }
  }, [activeMode, inputValue, pendingModeSwitchMessage, pendingModeSwitchTarget, user]);

  const processUserMessage = async (message: string) => {
    if (!message.trim() || !user) return;
    
    setIsSending(true);
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: message,
      timestamp: new Date(),
      mode: activeMode,
    };

    // Add user message to UI
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Save user message to database
    await saveChatMessage(user.id, userMessage.content, "user", activeMode);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Special command for image generation
      if (isImageGenerationRequest(message)) {
        await handleImageGeneration(userMessage.content);
        setIsSending(false);
        setIsTyping(false);
        return;
      }

      // Check if we should suggest a mode switch
      const suggestedMode = detectAppropriateMode(message, activeMode);
      
      if (suggestedMode) {
        console.log(`Suggesting mode switch from ${activeMode} to ${suggestedMode}`);
        
        // Create message suggesting mode switch
        const switchSuggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `You asked to: "${message}". This works better in ${suggestedMode} mode. Would you like to switch?`,
          timestamp: new Date(),
          mode: activeMode,
          modeSwitchAction: {
            text: `Switch to ${suggestedMode} mode`,
            action: `switch_to_${suggestedMode}`,
            targetMode: suggestedMode
          }
        };
        
        // Add suggestion to UI after small delay for realism
        await new Promise((resolve) => setTimeout(resolve, 500));
        setMessages((prev) => [...prev, switchSuggestionMessage]);
        
        // Save the suggestion message
        await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
          modeSwitchAction: switchSuggestionMessage.modeSwitchAction
        });
        
        setIsTyping(false);
        setIsSending(false);
        return;
      }

      // Process the message with the AI
      const aiResponse = await processAIRequest(
        message,
        activeMode,
        user.id
      );

      // Add realistic typing delay
      const typingDelay = Math.min(1000, aiResponse.response.length * 10);
      await new Promise((resolve) => setTimeout(resolve, typingDelay));

      // Check if AI suggests a mode switch (second method of detection)
      if (aiResponse.suggestedMode && aiResponse.suggestedMode !== activeMode) {
        // The edge function detected that another mode would be better
        const switchSuggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: aiResponse.response,
          timestamp: new Date(),
          mode: activeMode,
          modeSwitchAction: {
            text: `Switch to ${aiResponse.suggestedMode} mode`,
            action: `switch_to_${aiResponse.suggestedMode}`,
            targetMode: aiResponse.suggestedMode
          }
        };
        
        // Add suggestion to UI
        setMessages((prev) => [...prev, switchSuggestionMessage]);
        
        // Save the suggestion message
        await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
          modeSwitchAction: switchSuggestionMessage.modeSwitchAction
        });
        
        setIsTyping(false);
        setIsSending(false);
        return;
      }

      // Create the AI response message
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: aiResponse.response,
        timestamp: new Date(),
        mode: activeMode,
      };

      // If this was an intent to create something, add action buttons
      if (aiResponse.intent && aiResponse.intent !== "general_chat") {
        assistantMessage.actionButtons = {
          primary: {
            text: t("confirm" as TranslationKey, language),
            action: aiResponse.intent,
          },
          secondary: {
            text: t("cancel" as TranslationKey, language),
            action: "cancel",
          },
        };
        assistantMessage.metadata = {
          intentData: aiResponse.intentData,
        };
      }

      // Add assistant response to UI
      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant response to database
      await saveChatMessage(
        user.id,
        assistantMessage.content,
        "assistant",
        activeMode,
        {
          intentData: aiResponse.intentData,
          actionButtons: assistantMessage.actionButtons
        }
      );
    } catch (error) {
      console.error("Error processing message:", error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: t("errorProcessingRequest" as TranslationKey, language),
        timestamp: new Date(),
        mode: activeMode,
      };
      setMessages((prev) => [...prev, errorMessage]);
      showError(t("errorProcessingRequest" as TranslationKey, language));
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    setIsGeneratingImage(true);

    try {
      // Extract the image prompt
      const imagePrompt = extractImagePrompt(prompt);
      
      // Create loading message to show we're generating the image
      const loadingMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: t("generatingImage" as TranslationKey, language),
        timestamp: new Date(),
        mode: activeMode,
        isLoading: true
      };
      setMessages((prev) => [...prev, loadingMessage]);

      // Call the image generation service
      const imageUrl = await generateImage(imagePrompt);

      // Update the message with the image or error
      if (imageUrl) {
        const updatedMessage: ChatMessage = {
          ...loadingMessage,
          content: `${t(
            "imageGenerated" as TranslationKey,
            language
          )}\n\n![${t("generatedImage" as TranslationKey, language)}](${imageUrl})`,
          metadata: { imageUrl },
          isLoading: false
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === loadingMessage.id ? updatedMessage : msg
          )
        );

        // Save the message with the image URL
        await saveChatMessage(
          user!.id,
          updatedMessage.content,
          "assistant",
          activeMode,
          { imageUrl, hasMedia: true }
        );
      } else {
        throw new Error("Image generation failed");
      }
    } catch (error) {
      console.error("Error generating image:", error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: t("errorGeneratingImage" as TranslationKey, language),
        timestamp: new Date(),
        mode: activeMode,
      };
      setMessages((prev) => 
        prev.map((msg) => 
          // Using exact content comparison instead of type comparison
          msg.content === t("generatingImage" as TranslationKey, language) && msg.isLoading
            ? errorMessage 
            : msg
        )
      );
      showError(t("errorGeneratingImage" as TranslationKey, language));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    setInputValue(text);
    // Focus the input field after receiving transcription
    inputRef.current?.focus();
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    if (!user) {
      showError(t("loginRequired" as TranslationKey, language));
      return;
    }
    
    await processUserMessage(inputValue);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleConfirmAction = async (messageId: string, action: string) => {
    const message = messages.find((msg) => msg.id === messageId);
    if (!message || !user) return;

    // Special actions
    switch (action) {
      case "create_task":
        // Handle task creation using the intent data from the message
        const taskData = message.metadata?.intentData?.data || {
          title: "New Task",
        };
        showSuccess(t("taskCreated" as TranslationKey, language));
        
        // Add confirmation message
        const taskConfirmMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `✅ Task "${taskData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, taskConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          user.id,
          taskConfirmMessage.content,
          "assistant",
          activeMode
        );
        break;

      case "create_reminder":
        // Handle reminder creation
        const reminderData = message.metadata?.intentData?.data || {
          title: "New Reminder",
        };
        showSuccess(t("reminderCreated" as TranslationKey, language));
        
        // Add confirmation message
        const reminderConfirmMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `✅ Reminder "${reminderData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, reminderConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          user.id,
          reminderConfirmMessage.content,
          "assistant",
          activeMode
        );
        break;

      case "create_event":
        // Handle event creation
        const eventData = message.metadata?.intentData?.data || {
          title: "New Event",
        };
        showSuccess(t("eventCreated" as TranslationKey, language));
        
        // Add confirmation message
        const eventConfirmMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `✅ Event "${eventData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, eventConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          user.id,
          eventConfirmMessage.content,
          "assistant",
          activeMode
        );
        break;

      case "generate_image":
        // Handle image generation through the separate flow
        const imagePrompt = message.metadata?.intentData?.data?.prompt || "abstract art";
        await handleImageGeneration(imagePrompt);
        break;

      case "cancel":
        // User canceled the action
        const cancelMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `Action canceled.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, cancelMessage]);
        
        // Save cancellation to chat history
        await saveChatMessage(
          user.id,
          cancelMessage.content,
          "assistant",
          activeMode
        );
        break;

      default:
        if (action.startsWith("switch_to_")) {
          // Handle mode switching
          await handleModeSwitch(messageId, action);
          return;
        }
        console.log("Unknown action:", action);
    }

    // Remove action buttons after action is taken
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, actionButtons: undefined } : msg
      )
    );
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
          setActiveMode={setActiveMode}
          language={language as "en" | "ar"}
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
          theme={currentTheme}
        />

        {/* Fixed Bottom Bar */}
        <div
          className="py-3 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 left-0 right-0 w-full z-10 shadow-lg"
          dir={language === "ar" ? "rtl" : "ltr"}
        >
          <div className="flex items-center gap-2 max-w-md mx-auto">
            {/* Left Menu Button (Hamburger) */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsLeftDrawerOpen(true)}
              className="h-10 w-10 rounded-full flex-shrink-0"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Input Box with Voice Button */}
            <div className="flex-1">
              <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-300 dark:border-zinc-700">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={t("typeMessage" as TranslationKey, language)}
                  className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 pl-4 pr-1 h-10 rounded-full"
                  disabled={isSending || !user}
                />
                <div className="flex items-center px-1">
                  <VoiceInput
                    onTranscription={handleVoiceTranscription}
                    language={language}
                    theme={currentTheme}
                    disabled={isSending || isTyping || !user}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isSending || !user}
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-full"
                    type="submit"
                  >
                    {isSending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
              {!user && (
                <p className="text-xs text-center mt-1 text-muted-foreground">
                  {t("loginToChat" as TranslationKey, language)}
                </p>
              )}
            </div>

            {/* Right Menu Button (Settings/Tools) */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => setIsRightDrawerOpen(true)}
              className="h-10 w-10 rounded-full flex-shrink-0"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

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

