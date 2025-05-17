
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AIMode, ChatMessage } from "./types";
import { Loader2 } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import ReactMarkdown from 'react-markdown';
import { Skeleton } from "@/components/ui/skeleton";

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  activeMode: AIMode;
  getModeColor: (mode: AIMode) => string;
  onConfirm: (messageId: string, action: string) => void;
  messageEndRef: React.RefObject<HTMLDivElement>;
  language: string;
  theme: string;
  setActiveMode: (mode: AIMode) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isTyping,
  activeMode,
  getModeColor,
  onConfirm,
  messageEndRef,
  language,
  theme,
  setActiveMode
}) => {
  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  };

  // State to track mode switch animation
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [lastSwitchedMode, setLastSwitchedMode] = useState<AIMode | null>(null);

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

  // Track images that are loading
  const [loadingImages, setLoadingImages] = useState<{[key: string]: boolean}>({});
  // Track if mode switch was performed for a message
  const [processedSwitchMessages, setProcessedSwitchMessages] = useState<Set<string>>(new Set());

  // Function to render message content with markdown support and image loading states
  const renderMessageContent = (content: string, messageId: string, message: ChatMessage) => {
    // Don't render images until we're in the correct mode for the message
    const hasImageMarkdown = content.includes('![');
    const shouldRenderContent = !(hasImageMarkdown && message.mode === 'creative' && activeMode !== 'creative');
    
    if (!shouldRenderContent) {
      return <div className="italic text-sm">Loading content...</div>;
    }
    
    if (hasImageMarkdown) {
      return (
        <ReactMarkdown
          components={{
            img: ({ node, ...props }) => {
              // Set this message's image as loading when first rendered
              if (!loadingImages[messageId]) {
                setLoadingImages(prev => ({...prev, [messageId]: true}));
              }
              
              return (
                <div className="mt-2 overflow-hidden rounded-md">
                  {loadingImages[messageId] && (
                    <Skeleton className="w-full h-64 animate-pulse bg-zinc-300 dark:bg-zinc-700" />
                  )}
                  <img 
                    {...props}
                    className={`w-full h-auto object-cover transition-opacity duration-500 ${loadingImages[messageId] ? 'opacity-0' : 'opacity-100'}`}
                    loading="lazy"
                    onLoad={(e) => {
                      // Add a small delay before showing image to prevent flicker
                      setTimeout(() => {
                        setLoadingImages(prev => ({...prev, [messageId]: false}));
                      }, 250); // 250ms buffer to ensure mode switch is complete
                    }}
                    style={{ maxHeight: '300px' }}
                  />
                </div>
              );
            },
            p: ({ node, children }) => <p className="mb-2">{children}</p>,
            a: ({ node, children, ...props }) => (
              <a className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            )
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }
    
    // Regular message formatting with line breaks
    return (
      <div className="whitespace-pre-wrap text-sm">
        {content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Shimmer effect component for loading states
  const ShimmerEffect = () => (
    <div className="animate-pulse space-y-2">
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );

  // Get mode name for display
  const getModeName = (mode: AIMode): string => {
    switch(mode) {
      case "general": return "Chat";
      case "writer": return "Writer";
      case "creative": return "Creative";
      case "assistant": return "Assistant";
      default: return mode;
    }
  };

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
              
              // 1. Set switching mode animation flag
              setIsSwitchingMode(true);
              setLastSwitchedMode(message.modeSwitchAction.targetMode);
              
              // 2. Update the active mode
              setActiveMode(message.modeSwitchAction.targetMode);
              
              // 3. Wait briefly to allow visual transition before triggering action
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // 4. Reset animation flag
              setIsSwitchingMode(false);
              
              // 5. Trigger the action
              onConfirm(message.id, message.modeSwitchAction.action);
              console.log("Mode switched to:", message.modeSwitchAction.targetMode);
            }
          }
        }
      }
    };
    
    handleModeSwitches();
  }, [messages, onConfirm, processedSwitchMessages, setActiveMode]);

  return (
    <div className="flex-1 overflow-y-auto py-4 px-4 pb-16">
      <div className="max-w-md mx-auto space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            const styles = getMessageStyle(message);
            const isLastMessage = index === messages.length - 1;
            const showModeSwitchBadge = isAssistant && 
              index > 0 && 
              messages[index-1].mode !== message.mode && 
              message.mode !== activeMode;
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} w-full ${isLastMessage ? 'mb-8' : ''}`}
              >
                <div className={`max-w-[80%] flex ${isAssistant ? 'flex-row' : 'flex-row-reverse'} gap-2`}>
                  {isAssistant && (
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src="/lovable-uploads/a1b03773-fb9b-441e-8b2d-c8559acaa23b.png" alt="AI" />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col gap-1">
                    {/* Mode switch badge */}
                    {message.modeSwitchAction?.targetMode && (
                      <div className={`text-xs text-white px-2 py-0.5 rounded-md self-start mb-1 ${
                        message.modeSwitchAction.targetMode === 'creative' ? 'bg-amber-500' :
                        message.modeSwitchAction.targetMode === 'writer' ? 'bg-blue-500' :
                        message.modeSwitchAction.targetMode === 'assistant' ? 'bg-purple-500' :
                        'bg-gray-500'
                      }`}>
                        🔁 Switched to {getModeName(message.modeSwitchAction.targetMode)} mode
                      </div>
                    )}
                    
                    {/* Message Content */}
                    <div
                      className={`${styles?.bgColor} ${styles?.textColor} p-3 rounded-2xl ${isAssistant ? 'rounded-tl-none' : 'rounded-tr-none'}`}
                      style={{ 
                        borderLeft: isAssistant ? `2px solid ${styles?.borderColor}` : 'none',
                        borderRight: !isAssistant ? `2px solid ${styles?.borderColor}` : 'none'
                      }}
                    >
                      {message.isLoading ? (
                        <ShimmerEffect />
                      ) : renderMessageContent(message.content, message.id, message)}
                    </div>
                    
                    <span className="text-xs text-muted-foreground self-end">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Typing indicator with adjusted spacing */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start mb-20 mt-6"
          >
            <div className="flex items-center gap-2 max-w-[80%]">
              <Avatar className="h-8 w-8">
                <AvatarImage src="/lovable-uploads/a1b03773-fb9b-441e-8b2d-c8559acaa23b.png" alt="AI" />
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <div className={`bg-zinc-200 dark:bg-zinc-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-1`}>
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Mode switch animation indicator */}
        {isSwitchingMode && lastSwitchedMode && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-16 left-0 right-0 flex justify-center z-50"
          >
            <div className={`px-4 py-2 rounded-md text-white animate-pulse ${
              lastSwitchedMode === 'creative' ? 'bg-amber-500' :
              lastSwitchedMode === 'writer' ? 'bg-blue-500' :
              lastSwitchedMode === 'assistant' ? 'bg-purple-500' :
              'bg-gray-500'
            }`}>
              Switching to {getModeName(lastSwitchedMode)} mode...
            </div>
          </motion.div>
        )}
        
        {/* This empty div is for auto-scrolling to the bottom of chat */}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
};
