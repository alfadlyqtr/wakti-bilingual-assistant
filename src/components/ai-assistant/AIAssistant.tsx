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
import { modeController } from "@/utils/modeController";
import { processImageGeneration } from "@/services/imageService";

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

  // Language and theme state
  const language = "en" as "en" | "ar"; // This would normally come from user preferences
  const currentTheme = theme || "light";

  // Register with mode controller to keep local state in sync
  useEffect(() => {
    modeController.registerCallbacks({
      onAfterChange: (oldMode, newMode) => {
        setActiveMode(newMode);
      }
    });
  }, []);

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

  // Enhanced handleModeSwitch function - key part of the double echo pattern
  const handleModeSwitch = useCallback(async (messageId: string, action: string) => {
    if (action.startsWith("switch_to_") && user) {
      const newMode = action.replace("switch_to_", "") as AIMode;
      console.log(`Switching mode from ${activeMode} to ${newMode}`);
      
      // Find the message containing the original prompt
      const originalMessage = messages.find(m => m.id === messageId);
      if (!originalMessage || !originalMessage.originalPrompt) {
        console.error("Could not find original prompt for mode switch");
        return;
      }
      
      // Store the pending message from the original prompt
      const pendingMessage = originalMessage.originalPrompt;
      
      // Switch the mode using the controller
      await modeController.setActiveMode(newMode);
      
      // Add confirmation message with the double-echo pattern
      const confirmMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `We're now in ${newMode} mode.\n\nStill want me to do this: "${pendingMessage}"?`,
        timestamp: new Date(),
        mode: newMode
      };
      
      setMessages((prev) => [...prev, confirmMessage]);
      setPendingModeSwitchMessage(null);
      setPendingModeSwitchTarget(null);
      
      // Save the confirmation message
      await saveChatMessage(user.id, confirmMessage.content, "assistant", newMode, {
        pendingMessage
      });
      
      // Automatically process the pending message in the new mode
      await processUserMessage(pendingMessage);
      
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
      
      // Add cancellation message
      const cancelMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant", 
        content: "Mode switch completed, but action was cancelled.",
        timestamp: new Date(),
        mode: activeMode
      };
      
      setMessages(prev => [...prev, cancelMessage]);
      
      if (user) {
        await saveChatMessage(
          user.id, 
          cancelMessage.content, 
          "assistant", 
          activeMode
        );
      }
    } else {
      // Handle other action types (task creation, reminder, event, etc.)
      handleConfirmAction(messageId, action);
    }
  }, [activeMode, pendingModeSwitchMessage, pendingModeSwitchTarget, user, messages]);

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
      // Special handling for image generation - switch to creative mode automatically
      if (isImageGenerationRequest(message)) {
        // Check if we're already in creative mode
        if (activeMode !== "creative") {
          // First echo - suggest mode switch
          const switchSuggestionMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: `You asked to: "${message}". This works better in creative mode. Switching now...`,
            timestamp: new Date(),
            mode: activeMode,
            originalPrompt: message,
          };
          
          setMessages((prev) => [...prev, switchSuggestionMessage]);
          await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
            originalPrompt: message,
          });
          
          // Actually switch the mode
          await modeController.setActiveMode("creative");
          
          // Second echo - confirm mode switch and proceed
          const confirmSwitchMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: `We're now in creative mode. Generating image for: "${message}"`,
            timestamp: new Date(),
            mode: "creative",
            originalPrompt: message,
          };
          
          setMessages((prev) => [...prev, confirmSwitchMessage]);
          await saveChatMessage(user.id, confirmSwitchMessage.content, "assistant", "creative", {
            originalPrompt: message,
          });
        }
        
        await handleImageGeneration(message);
        setIsSending(false);
        setIsTyping(false);
        return;
      }

      // Check if we should suggest a mode switch for other types of requests
      const suggestedMode = detectAppropriateMode(message, activeMode);
      
      if (suggestedMode) {
        console.log(`Suggesting mode switch from ${activeMode} to ${suggestedMode}`);
        
        // First echo - suggest mode switch
        const switchSuggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `You asked to: "${message}". This works better in ${suggestedMode} mode. Switching now...`,
          timestamp: new Date(),
          mode: activeMode,
          originalPrompt: message
        };
        
        // Add suggestion to UI after small delay for realism
        await new Promise((resolve) => setTimeout(resolve, 500));
        setMessages((prev) => [...prev, switchSuggestionMessage]);
        
        // Save the suggestion message
        await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
          originalPrompt: message
        });
        
        // Actually switch the mode
        await modeController.setActiveMode(suggestedMode);
        
        // Second echo - confirm mode switch and proceed
        const confirmSwitchMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `We're now in ${suggestedMode} mode. Still want me to do this: "${message}"?`,
          timestamp: new Date(),
          mode: suggestedMode,
          originalPrompt: message
        };
        
        setMessages((prev) => [...prev, confirmSwitchMessage]);
        
        // Save the confirmation message
        await saveChatMessage(
          user.id, 
          confirmSwitchMessage.content, 
          "assistant", 
          suggestedMode, 
          {
            originalPrompt: message
          }
        );
        
        // Automatically process the request in the new mode without waiting for confirmation
        await processAIInCurrentMode(message);
        
        setIsTyping(false);
        setIsSending(false);
        return;
      }

      // If no mode switch needed, process in current mode
      await processAIInCurrentMode(message);
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

  // Process AI request in current mode
  const processAIInCurrentMode = async (message: string) => {
    if (!user) return;

    try {
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
        // First echo - suggest mode switch
        const switchSuggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `You asked to: "${aiResponse.originalPrompt || message}". This works better in ${aiResponse.suggestedMode} mode. Switching now...`,
          timestamp: new Date(),
          mode: activeMode,
          originalPrompt: aiResponse.originalPrompt || message
        };
        
        // Add suggestion to UI
        setMessages((prev) => [...prev, switchSuggestionMessage]);
        
        // Save the suggestion message
        await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
          originalPrompt: aiResponse.originalPrompt || message
        });
        
        // Switch the mode
        await modeController.setActiveMode(aiResponse.suggestedMode as AIMode);
        
        // Second echo - confirm mode switch and proceed
        const confirmSwitchMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: `We're now in ${aiResponse.suggestedMode} mode. Still want me to do this: "${aiResponse.originalPrompt || message}"?`,
          timestamp: new Date(),
          mode: aiResponse.suggestedMode as AIMode,
          originalPrompt: aiResponse.originalPrompt || message
        };
        
        setMessages((prev) => [...prev, confirmSwitchMessage]);
        
        // Save the confirmation message
        await saveChatMessage(
          user.id, 
          confirmSwitchMessage.content, 
          "assistant", 
          aiResponse.suggestedMode as AIMode, 
          {
            originalPrompt: aiResponse.originalPrompt || message
          }
        );
        
        // Process again in new mode
        const newResponse = await processAIRequest(
          aiResponse.originalPrompt || message,
          aiResponse.suggestedMode,
          user.id
        );
        
        // Create the AI response message in new mode
        const assistantMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: newResponse.response,
          timestamp: new Date(),
          mode: aiResponse.suggestedMode as AIMode,
        };
        
        // Add assistant response to UI
        setMessages((prev) => [...prev, assistantMessage]);
        
        // Save assistant response to database
        await saveChatMessage(
          user.id,
          assistantMessage.content,
          "assistant",
          aiResponse.suggestedMode as AIMode,
          {
            intentData: newResponse.intentData,
            actionButtons: assistantMessage.actionButtons
          }
        );
        
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
      console.error("Error in processAIInCurrentMode:", error);
      throw error;
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

      // Call the image generation service and save to database
      const result = await processImageGeneration(imagePrompt, user!.id);

      // FIX: Properly check for imageUrl property in the returned object
      if (result && result.imageUrl) {
        const updatedMessage: ChatMessage = {
          ...loadingMessage,
          content: `${t(
            "imageGenerated" as TranslationKey,
            language
          )}\n\n![${t("generatedImage" as TranslationKey, language)}](${result.imageUrl})`,
          metadata: { imageUrl: result.imageUrl, hasMedia: true },
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
          { imageUrl: result.imageUrl, hasMedia: true }
        );
      } else {
        // More informative error handling for troubleshooting
        console.error("Image generation failed - result:", result);
        throw new Error("Image generation failed or returned no URL");
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
    if (text && text.trim()) {
      setInputValue(text);
      // Process the voice transcription automatically
      setTimeout(() => {
        processUserMessage(text);
      }, 300);
    }
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
          messageEndRef={messageEndRef}
          language={language}
          theme={currentTheme}
          setActiveMode={setActiveMode}
        />

        {/* Fixed Bottom Bar - Added pb-20 to create more space above the mobile nav */}
        <div
          className="py-3 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 left-0 right-0 w-full z-10 shadow-lg pb-20"
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
