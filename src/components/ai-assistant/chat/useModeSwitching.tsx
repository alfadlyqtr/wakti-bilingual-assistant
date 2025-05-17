
import { useState, useEffect } from "react";
import { AIMode, ChatMessage, ASSISTANT_MODES } from "../types";
import { modeController } from "@/utils/modeController";
import { useTheme } from "@/providers/ThemeProvider";

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

  // Get mode name for display with proper translation
  const getModeName = (mode: AIMode): string => {
    const modeConfig = ASSISTANT_MODES.find(m => m.id === mode);
    return modeConfig ? modeConfig.label[language] : mode;
  };

  // Register with mode controller on mount
  useEffect(() => {
    const unregister = modeController.registerCallbacks({
      onBeforeChange: (oldMode, newMode) => {
        setIsSwitchingMode(true);
        setLastSwitchedMode(newMode);
      },
      onAfterChange: (oldMode, newMode) => {
        setIsSwitchingMode(false);
        // Update the creative mode flag
        setIsCreativeModeActive(newMode === 'creative');
      }
    });
    
    // Initialize creative mode flag
    setIsCreativeModeActive(activeMode === 'creative');
    
    return () => {
      unregister();
    };
  }, [activeMode]);

  // Auto-trigger mode switching without waiting for button clicks
  useEffect(() => {
    const handleModeSwitches = async () => {
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
              
              // Use the mode controller to change mode
              await modeController.setActiveMode(message.modeSwitchAction.targetMode);
              
              // Update the active mode in parent component
              setActiveMode(message.modeSwitchAction.targetMode);
              
              // Trigger the action
              onConfirm(message.id, message.modeSwitchAction.action);
              console.log("Mode switched to:", message.modeSwitchAction.targetMode);
            }
          }
        }
      }
    };
    
    handleModeSwitches();
  }, [messages, onConfirm, processedSwitchMessages, setActiveMode]);

  return {
    isSwitchingMode,
    lastSwitchedMode,
    isCreativeModeActive,
    getModeName
  };
};
