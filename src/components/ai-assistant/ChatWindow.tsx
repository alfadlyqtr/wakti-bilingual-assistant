
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
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isTyping,
  activeMode,
  getModeColor,
  onConfirm,
  messageEndRef,
  language,
  theme
}) => {
  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  };

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

  // Function to render message content with markdown support and image loading states
  const renderMessageContent = (content: string, messageId: string) => {
    // Check if content contains an image markdown
    const hasImageMarkdown = content.includes('![');
    
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
                      // Remove loading state once image loads
                      setLoadingImages(prev => ({...prev, [messageId]: false}));
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

  // Auto-trigger mode switching without waiting for button clicks
  useEffect(() => {
    console.log("ChatWindow received messages:", messages.length);
    const switchMessages = messages.filter(m => m.modeSwitchAction);
    
    if (switchMessages.length > 0) {
      console.log(`Found ${switchMessages.length} messages with modeSwitchAction:`, 
        switchMessages.map(m => ({
          id: m.id, 
          action: m.modeSwitchAction?.action,
          text: m.modeSwitchAction?.text,
          targetMode: m.modeSwitchAction?.targetMode,
          autoTrigger: m.modeSwitchAction?.autoTrigger
        })));
      
      // Auto-trigger mode switch for the latest message with modeSwitchAction
      // and autoTrigger flag
      const autoSwitchMessages = switchMessages.filter(m => 
        m.modeSwitchAction?.autoTrigger === true && 
        m.modeSwitchAction?.action
      );
      
      if (autoSwitchMessages.length > 0) {
        const latestSwitchMsg = autoSwitchMessages[autoSwitchMessages.length - 1];
        console.log("Auto-triggering mode switch for message:", latestSwitchMsg.id);
        
        // Immediately trigger the mode switch
        if (latestSwitchMsg.modeSwitchAction?.action) {
          onConfirm(latestSwitchMsg.id, latestSwitchMsg.modeSwitchAction.action);
          console.log("Auto-switched to mode:", latestSwitchMsg.modeSwitchAction?.targetMode);
        }
      }
    } else {
      console.log("No messages with modeSwitchAction found");
    }
  }, [messages, onConfirm]);

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

  return (
    <div className="flex-1 overflow-y-auto py-4 px-4 pb-16">
      <div className="max-w-md mx-auto space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            const styles = getMessageStyle(message);
            const isLastMessage = index === messages.length - 1;
            
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
                      ) : renderMessageContent(message.content, message.id)}
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
        
        {/* This empty div is for auto-scrolling to the bottom of chat */}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
};
