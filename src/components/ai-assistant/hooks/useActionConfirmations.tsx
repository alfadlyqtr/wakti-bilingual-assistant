
import { useCallback } from 'react';
import { v4 as uuidv4 } from "uuid";
import { AIMode, ChatMessage } from "../types";
import { useTheme } from "@/providers/ThemeProvider";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { saveChatMessage } from "@/services/chatService";
import { promptBrain } from "@/utils/promptBrain";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import { modeController } from "@/utils/modeController";

export const useActionConfirmations = (
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  activeMode: AIMode,
  processUserMessage: (message: string) => Promise<void>,
  handleDirectImageGeneration: (prompt: string) => Promise<void>,
  handleImageGeneration: (prompt: string) => Promise<void>,
  pendingModeSwitchMessage: string | null,
  setPendingModeSwitchMessage: React.Dispatch<React.SetStateAction<string | null>>,
  pendingModeSwitchTarget: AIMode | null,
  setPendingModeSwitchTarget: React.Dispatch<React.SetStateAction<AIMode | null>>
) => {
  const { language } = useTheme();
  const { showSuccess } = useToastHelper();
  
  // Function to get localized mode name
  const getModeName = (mode: AIMode): string => {
    switch (mode) {
      case "general": return language === 'ar' ? "عام" : "general";
      case "writer": return language === 'ar' ? "كاتب" : "writer";
      case "creative": return language === 'ar' ? "إبداعي" : "creative";
      case "assistant": return language === 'ar' ? "مساعد" : "assistant";
      default: return mode;
    }
  };

  // Handle mode switch (part of the double echo pattern)
  const handleModeSwitch = useCallback(async (messageId: string, action: string) => {
    if (action.startsWith("switch_to_")) {
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
      const success = await modeController.setActiveMode(newMode);
      
      if (success) {
        // Add confirmation message with the double-echo pattern
        const confirmMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: language === 'ar' 
            ? `نحن الآن في وضع ${getModeName(newMode)}.\n\nهل ما زلت تريدني أن أفعل هذا: "${pendingMessage}"؟`
            : `We're now in ${newMode} mode.\n\nStill want me to do this: "${pendingMessage}"?`,
          timestamp: new Date(),
          mode: newMode
        };
        
        setMessages((prev) => [...prev, confirmMessage]);
        setPendingModeSwitchMessage(null);
        setPendingModeSwitchTarget(null);
        
        if (originalMessage.metadata?.userId) {
          // Save the confirmation message
          await saveChatMessage(originalMessage.metadata.userId, confirmMessage.content, "assistant", newMode, {
            pendingMessage
          });
          
          // Automatically process the pending message in the new mode
          await processUserMessage(pendingMessage);
        }
      } else {
        // Try direct image generation if this is an image request
        const pendingMessage = originalMessage.originalPrompt;
        
        if (newMode === 'creative' && pendingMessage) {
          // Process the message directly without mode change
          await handleDirectImageGeneration(pendingMessage);
        } else {
          const errorMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `فشل التبديل إلى وضع ${getModeName(newMode)}. يرجى المحاولة مرة أخرى.`
              : `Failed to switch to ${newMode} mode. Please try again.`,
            timestamp: new Date(),
            mode: activeMode
          };
          
          setMessages((prev) => [...prev, errorMessage]);
          
          if (originalMessage.metadata?.userId) {
            await saveChatMessage(
              originalMessage.metadata.userId, 
              errorMessage.content, 
              "assistant", 
              activeMode
            );
          }
        }
      }
    } else if (action === "execute_pending" && pendingModeSwitchMessage) {
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
        content: language === 'ar'
          ? "تم اكتمال تبديل الوضع، ولكن تم إلغاء الإجراء."
          : "Mode switch completed, but action was cancelled.",
        timestamp: new Date(),
        mode: activeMode
      };
      
      setMessages(prev => [...prev, cancelMessage]);
      
      // Assume the first message has the user ID we need
      const firstUserMessage = messages.find(m => m.metadata?.userId);
      if (firstUserMessage?.metadata?.userId) {
        await saveChatMessage(
          firstUserMessage.metadata.userId, 
          cancelMessage.content, 
          "assistant", 
          activeMode
        );
      }
    }
  }, [activeMode, pendingModeSwitchMessage, pendingModeSwitchTarget, messages, language]);

  const handleConfirmAction = async (messageId: string, action: string) => {
    const message = messages.find((msg) => msg.id === messageId);
    if (!message) return;

    // If this is a mode switching action, handle separately
    if (action.startsWith("switch_to_") || action === "execute_pending" || action === "cancel_pending") {
      await handleModeSwitch(messageId, action);
      return;
    }
    
    // Get userId from the message metadata or from a previous message
    const userId = message.metadata?.userId || 
                   messages.find(m => m.metadata?.userId)?.metadata?.userId;
    
    if (!userId) {
      console.error("No user ID found for action confirmation");
      return;
    }

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
          content: language === 'ar'
            ? `✅ تم إنشاء المهمة "${taskData.title}" بنجاح.`
            : `✅ Task "${taskData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, taskConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          userId,
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
          content: language === 'ar'
            ? `✅ تم إنشاء التذكير "${reminderData.title}" بنجاح.`
            : `✅ Reminder "${reminderData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, reminderConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          userId,
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
          content: language === 'ar'
            ? `✅ تم إنشاء الفعالية "${eventData.title}" بنجاح.`
            : `✅ Event "${eventData.title}" created successfully.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, eventConfirmMessage]);
        
        // Save confirmation to chat history
        await saveChatMessage(
          userId,
          eventConfirmMessage.content,
          "assistant",
          activeMode
        );
        break;

      case "generate_image":
        // Handle image generation
        const imagePrompt = message.metadata?.intentData?.data?.prompt || "abstract art";
        await handleImageGeneration(imagePrompt);
        break;

      case "retry_with_enhancement":
        // Retry image generation with enhanced prompt
        const originalPrompt = promptBrain.getMemory().lastImagePrompt || "abstract art";
        const enhancedPrompt = promptBrain.enhanceImagePrompt(originalPrompt);
        
        // Add message about enhancement
        const enhancementMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: language === 'ar'
            ? `جاري محاولة إنشاء صورة بوصف محسّن: "${enhancedPrompt}"`
            : `Trying with enhanced prompt: "${enhancedPrompt}"`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, enhancementMessage]);
        
        // Save message to history
        await saveChatMessage(
          userId,
          enhancementMessage.content,
          "assistant",
          activeMode
        );
        
        // Generate with enhanced prompt
        await handleDirectImageGeneration(enhancedPrompt);
        break;
      
      case "cancel":
        // User canceled the action
        const cancelMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: language === 'ar'
            ? `تم إلغاء الإجراء.`
            : `Action canceled.`,
          timestamp: new Date(),
          mode: activeMode,
        };
        setMessages((prev) => [...prev, cancelMessage]);
        
        // Save cancellation to chat history
        await saveChatMessage(
          userId,
          cancelMessage.content,
          "assistant",
          activeMode
        );
        break;

      case "acknowledge":
        // User acknowledged the message, no need for additional message
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

  return {
    handleConfirmAction,
    handleModeSwitch
  };
};
