
import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { AIMode, ChatMessage, ASSISTANT_MODES } from "./types";
import { ModeSelector } from "./ModeSelector";
import { v4 as uuidv4 } from "uuid";
import { toast } from "@/hooks/use-toast";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import {
  saveChatMessage,
  getRecentChatHistory,
  processAIRequest,
  generateImage,
} from "@/services/chatService";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import Loading from "@/components/ui/loading";

const getDefaultWelcomeMessage = (language: string): string => {
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

  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { isMobile } = useIsMobile();
  const { theme } = useTheme();
  const { user, session } = useAuth();

  // Language and theme state
  const language = "en"; // This would normally come from user preferences
  const currentTheme = theme || "light";

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      role: "assistant",
      content: getDefaultWelcomeMessage(language),
      timestamp: new Date(),
      mode: "general",
    };
    setMessages([welcomeMessage]);

    // Load chat history if user is authenticated
    if (user) {
      loadChatHistory();
    }
  }, [user, language]);

  // Load chat history from Supabase
  const loadChatHistory = async () => {
    if (!user) return;

    const history = await getRecentChatHistory(user.id, null, 20);
    if (history.length > 0) {
      // Only set history if it's not empty
      // We're not replacing the welcome message if there's no history
      setMessages(history);
    }
  };

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    if (!user) {
      toast({
        title: t("loginRequired" as TranslationKey, language),
        description: t("pleaseLoginToChat" as TranslationKey, language),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: inputValue,
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
      if (
        inputValue.toLowerCase().startsWith("/image") ||
        inputValue.toLowerCase().includes("generate image") ||
        inputValue.toLowerCase().includes("create image") ||
        inputValue.toLowerCase().includes("draw")
      ) {
        await handleImageGeneration(userMessage.content);
        setIsSending(false);
        setIsTyping(false);
        return;
      }

      // Process the message with the AI
      const aiResponse = await processAIRequest(
        userMessage.content,
        activeMode,
        user.id
      );

      // Add realistic typing delay
      const typingDelay = Math.min(1000, aiResponse.response.length * 10);
      await new Promise((resolve) => setTimeout(resolve, typingDelay));

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
        assistantMessage.metadata
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
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  const handleImageGeneration = async (prompt: string) => {
    setIsGeneratingImage(true);

    try {
      // Extract the image prompt
      let imagePrompt = prompt;
      if (prompt.toLowerCase().startsWith("/image")) {
        imagePrompt = prompt.substring(6).trim();
      }

      // Create assistant message to show we're generating the image
      const processingMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: t("generatingImage" as TranslationKey, language),
        timestamp: new Date(),
        mode: activeMode,
      };
      setMessages((prev) => [...prev, processingMessage]);

      // Call the image generation service
      const imageUrl = await generateImage(imagePrompt);

      // Update the message with the image or error
      if (imageUrl) {
        const updatedMessage: ChatMessage = {
          ...processingMessage,
          content: `${t(
            "imageGenerated" as TranslationKey,
            language
          )}\n\n![${t("generatedImage" as TranslationKey, language)}](${imageUrl})`,
          metadata: { imageUrl },
        };
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === processingMessage.id ? updatedMessage : msg
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
          msg.content === t("generatingImage" as TranslationKey, language) 
            ? errorMessage 
            : msg
        )
      );
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleVoiceTranscription = (text: string) => {
    setInputValue(text);
    // Focus the input field after receiving transcription
    inputRef.current?.focus();
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
        toast({
          title: t("taskCreated" as TranslationKey, language),
          description: taskData.title,
        });
        break;

      case "create_reminder":
        // Handle reminder creation
        const reminderData = message.metadata?.intentData?.data || {
          title: "New Reminder",
        };
        toast({
          title: t("reminderCreated" as TranslationKey, language),
          description: reminderData.title,
        });
        break;

      case "create_event":
        // Handle event creation
        const eventData = message.metadata?.intentData?.data || {
          title: "New Event",
        };
        toast({
          title: t("eventCreated" as TranslationKey, language),
          description: eventData.title,
        });
        break;

      case "cancel":
        // User canceled the action
        break;

      default:
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
    <div
      className={`flex flex-col h-full relative`}
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
        theme={currentTheme}
      />

      {/* Input Area */}
      <div
        className="py-2 px-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0 w-full"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <div
          className={`flex ${isMobile ? "items-end" : "items-center"} gap-2 max-w-md mx-auto`}
        >
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsLeftDrawerOpen(true)}
            className="h-9 w-9 rounded-full"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex-1 flex flex-col">
            <div
              className={`flex ${
                isMobile ? "flex-col" : "flex-row"
              } items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg`}
            >
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={t("typeMessage" as TranslationKey, language)}
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                disabled={isSending || !user}
              />
              <div className="flex items-center">
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

          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsRightDrawerOpen(true)}
            className="h-9 w-9 rounded-full"
          >
            <PlusCircle className="h-5 w-5" />
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
  );
};
