import { useState, useEffect } from "react";
import { ChatMessage, AIMode } from "../types";
import { v4 as uuidv4 } from "uuid";
import { getRecentChatHistory } from "@/services/chatService";
import { useTheme } from "@/providers/ThemeProvider";

// Helper function for default welcome message
const getDefaultWelcomeMessage = (language: "en" | "ar"): string => {
  return language === "ar"
    ? "مرحبًا! أنا وكتي، مساعدك الذكي. كيف يمكنني مساعدتك اليوم؟"
    : "Hello! I'm WAKTI, your smart assistant. How can I help you today?";
};

export const useChatHistory = (userId: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const { language } = useTheme();
  
  // Initialize chat with history or welcome message
  useEffect(() => {
    const initializeChat = async () => {
      if (userId && !historyLoaded) {
        console.log("Initializing chat with user:", userId);
        await loadChatHistory(userId);
        setHistoryLoaded(true);
      } else if (!userId && !historyLoaded) {
        console.log("Setting welcome message for anonymous user");
        const welcomeMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: getDefaultWelcomeMessage(language as "en" | "ar"),
          timestamp: new Date(),
          mode: "general",
        };
        setMessages([welcomeMessage]);
        setHistoryLoaded(true);
      }
    };

    initializeChat();
  }, [userId, language]);

  // Re-initialize chat when user logs in/out
  useEffect(() => {
    if (userId === null && historyLoaded) {
      // User logged out, reset to welcome message
      setHistoryLoaded(false);
      setMessages([]);
    }
  }, [userId]);

  // Load chat history from database
  const loadChatHistory = async (userId: string) => {
    try {
      console.log("Loading chat history for user:", userId);
      const history = await getRecentChatHistory(userId, null, 20);
      
      if (history.length > 0) {
        console.log(`Loaded ${history.length} chat messages from history`);
        setMessages(history);
      } else {
        // If no history, show welcome message
        console.log("No chat history found, showing welcome message");
        const welcomeMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: getDefaultWelcomeMessage(language as "en" | "ar"),
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
        content: getDefaultWelcomeMessage(language as "en" | "ar"),
        timestamp: new Date(),
        mode: "general",
      };
      setMessages([welcomeMessage]);
    }
  };

  return {
    messages,
    setMessages,
    historyLoaded
  };
};
