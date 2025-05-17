
import { AIMode, ChatMessage } from "../types";

export const useMessageStyles = (theme: string) => {
  // Get background and text colors based on mode and message role
  const getMessageStyle = (message: ChatMessage) => {
    const modeColor = getModeColor(message.mode);
    
    if (message.role === 'assistant') {
      return {
        bgColor: theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-200',
        textColor: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900',
        borderColor: modeColor
      };
    } else {
      // User messages - use more vibrant colors
      if (message.mode === 'general') { // Chat
        return {
          bgColor: theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300',
          textColor: theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900',
          borderColor: modeColor
        };
      } else if (message.mode === 'writer') { // Type
        return {
          bgColor: theme === 'dark' ? 'bg-blue-950' : 'bg-blue-100',
          textColor: theme === 'dark' ? 'text-blue-100' : 'text-blue-900',
          borderColor: modeColor
        };
      } else if (message.mode === 'creative') { // Create
        return {
          bgColor: theme === 'dark' ? 'bg-amber-950' : 'bg-amber-100',
          textColor: theme === 'dark' ? 'text-amber-100' : 'text-amber-900',
          borderColor: modeColor
        };
      } else if (message.mode === 'assistant') { // Plan
        return {
          bgColor: theme === 'dark' ? 'bg-purple-950' : 'bg-purple-100', 
          textColor: theme === 'dark' ? 'text-purple-100' : 'text-purple-900',
          borderColor: modeColor
        };
      }
    }
  };
  
  // Get mode color for styling
  const getModeColor = (mode: AIMode) => {
    switch(mode) {
      case 'general': return '#71717a'; // gray-500
      case 'writer': return '#3b82f6'; // blue-500
      case 'creative': return '#f59e0b'; // amber-500
      case 'assistant': return '#8b5cf6'; // purple-500
      default: return '#71717a'; // gray-500
    }
  };
  
  return { getMessageStyle, getModeColor };
};
