
import { useState, useCallback } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { v4 as uuidv4 } from "uuid";
import { AIMode, ChatMessage } from "../types";
import { useTheme } from "@/providers/ThemeProvider";
import { useToastHelper } from "@/hooks/use-toast-helper";
import { saveChatMessage, processAIRequest, generateImage, isImageGenerationRequest, 
  extractImagePrompt, directImageGeneration } from "@/services/chatService";
import { processImageGeneration } from "@/services/imageService";
import { promptBrain } from "@/utils/promptBrain";
import { modeController } from "@/utils/modeController";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";

export const useChatActions = (
  messages: ChatMessage[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  activeMode: AIMode,
  isTyping: boolean,
  setIsTyping: React.Dispatch<React.SetStateAction<boolean>>,
  isSending: boolean,
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const { user } = useAuth();
  const { language } = useTheme();
  const { showSuccess, showError, showInfo } = useToastHelper();
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [useDirectImageGeneration, setUseDirectImageGeneration] = useState(false);
  const [pendingModeSwitchMessage, setPendingModeSwitchMessage] = useState<string | null>(null);
  const [pendingModeSwitchTarget, setPendingModeSwitchTarget] = useState<AIMode | null>(null);

  const processUserMessage = async (message: string) => {
    if (!message.trim() || !user) return;
    
    setIsSending(true);
    
    // Use our new promptBrain to preprocess the message
    const processedMessage = promptBrain.preprocessPrompt(message, activeMode);
    
    // Update memory with the current prompt
    promptBrain.updateMemory({
      lastPrompt: processedMessage,
      lastMode: activeMode
    });
    
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: processedMessage,
      timestamp: new Date(),
      mode: activeMode,
    };

    // Add user message to UI
    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database
    await saveChatMessage(user.id, userMessage.content, "user", activeMode);

    // Show typing indicator
    setIsTyping(true);

    try {
      // Direct path for image generation if mode switching is problematic or if requested
      if ((useDirectImageGeneration || activeMode === 'creative') && isImageGenerationRequest(processedMessage)) {
        console.log("Processing image generation directly without mode switching");
        await handleDirectImageGeneration(processedMessage);
        setIsSending(false);
        setIsTyping(false);
        return;
      }
      
      // Special handling for image generation - switch to creative mode automatically
      if (isImageGenerationRequest(processedMessage)) {
        // Check if we're already in creative mode
        if (activeMode !== "creative") {
          // First echo - suggest mode switch
          const switchSuggestionMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `طلبت: "${processedMessage}". هذا يعمل بشكل أفضل في وضع الإبداع. جاري التبديل...`
              : `You asked to: "${processedMessage}". This works better in creative mode. Switching now...`,
            timestamp: new Date(),
            mode: activeMode,
            originalPrompt: processedMessage,
          };
          
          setMessages((prev) => [...prev, switchSuggestionMessage]);
          await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
            originalPrompt: processedMessage,
          });
          
          // Actually switch the mode
          const switchSuccess = await modeController.setActiveMode("creative");
          
          if (switchSuccess) {
            // Second echo - confirm mode switch and proceed
            const confirmSwitchMessage: ChatMessage = {
              id: uuidv4(),
              role: "assistant",
              content: language === 'ar'
                ? `نحن الآن في وضع الإبداع. جاري إنشاء صورة لـ: "${processedMessage}"`
                : `We're now in creative mode. Generating image for: "${processedMessage}"`,
              timestamp: new Date(),
              mode: "creative",
              originalPrompt: processedMessage,
            };
            
            setMessages((prev) => [...prev, confirmSwitchMessage]);
            await saveChatMessage(user.id, confirmSwitchMessage.content, "assistant", "creative", {
              originalPrompt: processedMessage,
            });
            
            await handleImageGeneration(processedMessage);
          } else {
            // Mode switch failed, use direct generation instead
            console.log("Mode switch failed, using direct image generation instead");
            setUseDirectImageGeneration(true);
            await handleDirectImageGeneration(processedMessage);
          }
          
          setIsSending(false);
          setIsTyping(false);
          return;
        } else {
          // Already in creative mode, process image normally
          await handleImageGeneration(processedMessage);
          setIsSending(false);
          setIsTyping(false);
          return;
        }
      }

      // Use our new promptBrain for smarter mode detection
      const intent = promptBrain.detectIntent(processedMessage);
      const suggestedMode = intent.suggestedMode;
      
      if (suggestedMode && suggestedMode !== activeMode) {
        console.log(`Suggesting mode switch from ${activeMode} to ${suggestedMode}`);
        
        // First echo - suggest mode switch
        const switchSuggestionMessage: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content: language === 'ar'
            ? `طلبت: "${processedMessage}". هذا يعمل بشكل أفضل في وضع ${getModeName(suggestedMode)}. جاري التبديل...`
            : `You asked to: "${processedMessage}". This works better in ${suggestedMode} mode. Switching now...`,
          timestamp: new Date(),
          mode: activeMode,
          originalPrompt: processedMessage
        };
        
        // Add suggestion to UI after small delay for realism
        await new Promise((resolve) => setTimeout(resolve, 500));
        setMessages((prev) => [...prev, switchSuggestionMessage]);
        
        // Save the suggestion message
        await saveChatMessage(user.id, switchSuggestionMessage.content, "assistant", activeMode, {
          originalPrompt: processedMessage
        });
        
        // Actually switch the mode
        const switchSuccess = await modeController.setActiveMode(suggestedMode);
        
        if (switchSuccess) {
          // Second echo - confirm mode switch and proceed
          const confirmSwitchMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `نحن الآن في وضع ${getModeName(suggestedMode)}. ما زلت تريد مني أن أفعل هذا: "${processedMessage}"؟`
              : `We're now in ${suggestedMode} mode. Still want me to do this: "${processedMessage}"?`,
            timestamp: new Date(),
            mode: suggestedMode,
            originalPrompt: processedMessage
          };
          
          setMessages((prev) => [...prev, confirmSwitchMessage]);
          
          // Save the confirmation message
          await saveChatMessage(
            user.id, 
            confirmSwitchMessage.content, 
            "assistant", 
            suggestedMode, 
            {
              originalPrompt: processedMessage
            }
          );
          
          // Automatically process the request in the new mode
          await processAIInCurrentMode(processedMessage);
        } else {
          // Handle mode switch failure
          console.error("Mode switch failed, processing in current mode");
          const errorMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `فشل في تبديل الأوضاع. معالجة طلبك في وضع ${getModeName(activeMode)} بدلاً من ذلك.`
              : `Failed to switch modes. Processing your request in ${activeMode} mode instead.`,
            timestamp: new Date(),
            mode: activeMode
          };
          
          setMessages((prev) => [...prev, errorMessage]);
          await saveChatMessage(user.id, errorMessage.content, "assistant", activeMode);
        }
        
        setIsTyping(false);
        setIsSending(false);
        return;
      }

      // If no mode switch needed, process in current mode
      await processAIInCurrentMode(processedMessage);
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
          content: language === 'ar'
            ? `طلبت: "${aiResponse.originalPrompt || message}". هذا يعمل بشكل أفضل في وضع ${getModeName(aiResponse.suggestedMode as AIMode)}. جاري التبديل...`
            : `You asked to: "${aiResponse.originalPrompt || message}". This works better in ${aiResponse.suggestedMode} mode. Switching now...`,
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
        const switchSuccess = await modeController.setActiveMode(aiResponse.suggestedMode as AIMode);
        
        if (switchSuccess) {
          // Second echo - confirm mode switch and proceed
          const confirmSwitchMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `نحن الآن في وضع ${getModeName(aiResponse.suggestedMode as AIMode)}. ما زلت تريد مني أن أفعل هذا: "${aiResponse.originalPrompt || message}"؟`
              : `We're now in ${aiResponse.suggestedMode} mode. Still want me to do this: "${aiResponse.originalPrompt || message}"?`,
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
        } else {
          // Handle mode switch failure
          console.error("Mode switch failed, processing in current mode");
          const errorMessage: ChatMessage = {
            id: uuidv4(),
            role: "assistant",
            content: language === 'ar'
              ? `فشل في تبديل الأوضاع. معالجة طلبك في وضع ${getModeName(activeMode)} بدلاً من ذلك.`
              : `Failed to switch modes. Processing your request in ${activeMode} mode instead.`,
            timestamp: new Date(),
            mode: activeMode
          };
          
          setMessages((prev) => [...prev, errorMessage]);
          await saveChatMessage(user.id, errorMessage.content, "assistant", activeMode);
        }
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
      
      // Enhance the prompt with our brain
      const enhancedPrompt = promptBrain.processPromptForMode(imagePrompt, 'creative');
      
      console.log(`Generating image with prompt: "${enhancedPrompt}" in language: ${language}`);
      
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
      const result = await processImageGeneration(enhancedPrompt, user!.id);

      // Store in memory
      if (result && result.imageUrl) {
        promptBrain.updateMemory({
          lastImagePrompt: prompt,
          lastImageUrl: result.imageUrl,
          lastAction: "image_generation"
        });
      }

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
          { 
            imageUrl: result.imageUrl, 
            hasMedia: true,
            intentData: { 
              directGeneration: false 
            }
          }
        );
      } else {
        // More informative error handling for troubleshooting
        console.error("Image generation failed - result:", result);
        
        // If standard generation failed, try direct method
        if (useDirectImageGeneration) {
          throw new Error("Both standard and direct image generation failed");
        } else {
          console.log("Standard image generation failed, trying direct method");
          setUseDirectImageGeneration(true);
          await handleDirectImageGeneration(prompt);
          
          // Remove the loading message since we're showing a different one
          setMessages((prev) => 
            prev.filter((msg) => msg.id !== loadingMessage.id)
          );
          return;
        }
      }
    } catch (error) {
      console.error("Error generating image:", error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar' 
          ? "تعذر إنشاء الصورة. هل تريد أن أحاول بوصف محسّن للصورة؟"
          : "Failed to generate the image. Would you like me to try with an enhanced prompt?",
        timestamp: new Date(),
        mode: activeMode,
        actionButtons: {
          primary: {
            text: language === 'ar' ? "نعم، حاول بوصف محسّن" : "Try with enhanced prompt",
            action: "retry_with_enhancement",
          },
          secondary: {
            text: language === 'ar' ? "لا، شكراً" : "No, thanks",
            action: "cancel",
          },
        }
      };
      setMessages((prev) => 
        prev.map((msg) => 
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

  const handleDirectImageGeneration = async (prompt: string) => {
    setIsGeneratingImage(true);
    
    try {
      // Extract the image prompt
      const imagePrompt = extractImagePrompt(prompt);
      
      // Enhance the prompt with our brain
      const enhancedPrompt = promptBrain.processPromptForMode(imagePrompt, 'creative');
      
      console.log(`Direct image generation with prompt: "${enhancedPrompt}"`);
      
      // Create loading message
      const loadingMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: `${t("generatingImage" as TranslationKey, language)}`,
        timestamp: new Date(),
        mode: activeMode,
        isLoading: true
      };
      setMessages((prev) => [...prev, loadingMessage]);
      
      // Call direct image generation
      const result = await directImageGeneration(enhancedPrompt, user!.id);
      
      // Store in memory
      if (result && result.imageUrl) {
        promptBrain.updateMemory({
          lastImagePrompt: prompt,
          lastImageUrl: result.imageUrl,
          lastAction: "image_generation"
        });
      }
      
      if (result && result.imageUrl) {
        const updatedMessage: ChatMessage = {
          ...loadingMessage,
          content: `${t(
            "imageGenerated" as TranslationKey,
            language
          )}\n\n![${t("generatedImage" as TranslationKey, language)}](${result.imageUrl})`,
          metadata: { 
            imageUrl: result.imageUrl, 
            hasMedia: true
          },
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
          { 
            imageUrl: result.imageUrl, 
            hasMedia: true,
            intentData: { 
              directGeneration: true 
            }
          }
        );
      } else {
        throw new Error("Direct image generation failed");
      }
    } catch (error) {
      console.error("Error in direct image generation:", error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        role: "assistant",
        content: language === 'ar'
          ? "تعذر إنشاء الصورة. يرجى المحاولة مرة أخرى بوصف مختلف."
          : "Image generation failed. Please try again with a different prompt.",
        timestamp: new Date(),
        mode: activeMode,
        actionButtons: {
          primary: {
            text: language === 'ar' ? "حاول بوصف محسّن" : "Try with enhanced prompt",
            action: "retry_with_enhancement",
          },
          secondary: {
            text: language === 'ar' ? "حسناً" : "OK",
            action: "acknowledge",
          }
        }
      };
      setMessages((prev) => 
        prev.map((msg) => 
          msg.isLoading ? errorMessage : msg
        )
      );
      showError(t("errorGeneratingImage" as TranslationKey, language));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const getModeName = (mode: AIMode): string => {
    switch (mode) {
      case "general": return language === 'ar' ? "عام" : "general";
      case "writer": return language === 'ar' ? "كاتب" : "writer";
      case "creative": return language === 'ar' ? "إبداعي" : "creative";
      case "assistant": return language === 'ar' ? "مساعد" : "assistant";
      default: return mode;
    }
  };

  return {
    processUserMessage,
    handleDirectImageGeneration,
    handleImageGeneration,
    getModeName,
    isGeneratingImage,
    useDirectImageGeneration,
    setUseDirectImageGeneration,
    pendingModeSwitchMessage,
    setPendingModeSwitchMessage,
    pendingModeSwitchTarget,
    setPendingModeSwitchTarget
  };
};
