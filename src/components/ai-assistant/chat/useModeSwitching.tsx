
import { useState, useEffect } from "react";
import { AIMode, ChatMessage, ASSISTANT_MODES } from "../types";
import { modeController } from "@/utils/modeController";
import { useTheme } from "@/providers/ThemeProvider";
import { toast } from "sonner";

interface UseModeSwitchingProps {
  activeMode: AIMode;
  messages: ChatMessage[];
  onConfirm: (messageId: string, action: string) => void;
  setActiveMode: (mode: AIMode) => void;
}

export const useModeSwitching = ({
  activeMode,
  messages,
  onConfirm,
  setActiveMode
}: UseModeSwitchingProps) => {
  const { language } = useTheme();
  
  // State to track mode switch animation
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [lastSwitchedMode, setLastSwitchedMode] = useState<AIMode | null>(null);
  
  // Track if we're ready to show images (active mode is creative)
  const [isCreativeModeActive, setIsCreativeModeActive] = useState(activeMode === 'creative');
  
  // Track if mode switch was performed for a message
  const [processedSwitchMessages, setProcessedSwitchMessages] = useState<Set<string>>(new Set());
  
  // Track any errors that occurred during mode switching
  const [switchError, setSwitchError] = useState<string | null>(null);

  // Additional shimmer delay for creative mode
  const [creativeModeReady, setCreativeModeReady] = useState(false);

  // Get mode name for display with proper translation
  const getModeName = (mode: AIMode): string => {
    const modeConfig = ASSISTANT_MODES.find(m => m.id === mode);
    return modeConfig ? modeConfig.label[language] : mode;
  };

  // Register with mode controller on mount
  useEffect(() => {
    const unregister = modeController.registerCallbacks({
      onBeforeChange: (oldMode, newMode) => {
        console.log(`Mode switching from ${oldMode} to ${newMode}: started`);
        setIsSwitchingMode(true);
        setCreativeModeReady(false); // Reset creative mode readiness
        setLastSwitchedMode(newMode);
      },
      onAfterChange: (oldMode, newMode) => {
        console.log(`Mode switching from ${oldMode} to ${newMode}: completed`);
        setIsSwitchingMode(false);
        
        // Update the creative mode flag
        const isCreative = newMode === 'creative';
        setIsCreativeModeActive(isCreative);
        
        // If switching to creative mode, add a shimmer delay before marking ready
        if (isCreative) {
          setTimeout(() => {
            setCreativeModeReady(true);
          }, 250); // 250ms buffer delay for creative mode
        } else {
          setCreativeModeReady(true); // Immediately ready for non-creative modes
        }
        
        // Clear any error when a successful mode switch happens
        setSwitchError(null);
      }
    });
    
    // Initialize creative mode flag and readiness
    const isCreative = activeMode === 'creative';
    setIsCreativeModeActive(isCreative);
    setCreativeModeReady(true); // Initially ready
    
    return () => {
      unregister();
    };
  }, [activeMode]);

  // Reset controller if it gets stuck
  useEffect(() => {
    // If switching mode takes too long (over 5 seconds), reset the controller
    let timeoutId: number | null = null;
    
    if (isSwitchingMode) {
      timeoutId = window.setTimeout(() => {
        console.log("Mode switch taking too long, resetting controller");
        modeController.resetState();
        setIsSwitchingMode(false);
        setSwitchError(language === 'ar' 
          ? "انتهت مهلة تبديل الوضع. يرجى المحاولة مرة أخرى."
          : "Mode switch timed out. Please try again."
        );
        toast.error(language === 'ar' 
          ? "فشل في تبديل الوضع"
          : "Failed to switch mode"
        );
      }, 5000);
    }
    
    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [isSwitchingMode, language]);

  // Auto-trigger mode switching without waiting for button clicks
  useEffect(() => {
    const handleModeSwitches = async () => {
      // Skip processing if we're already in the middle of a mode switch
      if (isSwitchingMode) {
        console.log("Mode switch already in progress, skipping");
        return;
      }
      
      // Find messages with modeSwitchAction that haven't been processed yet
      const switchMessages = messages.filter(m => 
        m.modeSwitchAction && 
        !processedSwitchMessages.has(m.id)
      );
      
      if (switchMessages.length > 0) {
        console.log(`Found ${switchMessages.length} unprocessed messages with modeSwitchAction`);
        
        // Process each switch message in sequence
        for (const message of switchMessages) {
          if (message.modeSwitchAction?.targetMode && message.modeSwitchAction?.action) {
            console.log(`Processing mode switch for message ${message.id} to mode ${message.modeSwitchAction.targetMode}`);
            
            // Mark as being processed to prevent duplicate processing
            setProcessedSwitchMessages(prev => new Set([...prev, message.id]));
            
            if (message.modeSwitchAction.autoTrigger === true) {
              console.log("Auto-triggering mode switch for message:", message.id);
              
              try {
                // Use the mode controller to change mode
                const success = await modeController.setActiveMode(message.modeSwitchAction.targetMode);
                
                if (success) {
                  // Update the active mode in parent component
                  setActiveMode(message.modeSwitchAction.targetMode);
                  
                  // Short delay to allow UI to update before triggering the action
                  setTimeout(() => {
                    // Trigger the action
                    onConfirm(message.id, message.modeSwitchAction!.action);
                    console.log("Mode switched to:", message.modeSwitchAction!.targetMode);
                  }, 300);
                } else {
                  // Handle error case
                  const error = modeController.getLastError();
                  console.error("Mode switch failed:", error);
                  setSwitchError(language === 'ar'
                    ? `فشل في التبديل إلى وضع ${getModeName(message.modeSwitchAction.targetMode)}. يرجى المحاولة مرة أخرى.`
                    : `Failed to switch to ${getModeName(message.modeSwitchAction.targetMode)} mode. Please try again.`
                  );
                  
                  // Reset the controller
                  modeController.resetState();
                }
              } catch (error) {
                console.error("Error during mode switch:", error);
                setSwitchError(language === 'ar'
                  ? `خطأ أثناء تبديل الأوضاع: ${error instanceof Error ? error.message : String(error)}`
                  : `Error switching modes: ${error instanceof Error ? error.message : String(error)}`
                );
              }
            }
          }
        }
      }
    };
    
    handleModeSwitches();
  }, [messages, onConfirm, processedSwitchMessages, setActiveMode, isSwitchingMode, language]);

  return {
    isSwitchingMode,
    lastSwitchedMode,
    isCreativeModeActive,
    creativeModeReady,
    getModeName,
    switchError,
    resetSwitchError: () => setSwitchError(null)
  };
};
