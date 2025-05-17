
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AIMode, ChatMessage } from "./types";
import { Loader2 } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import ReactMarkdown from 'react-markdown';

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

  // Function to render message content with markdown support
  const renderMessageContent = (content: string) => {
    // Check if content contains an image markdown
    const hasImageMarkdown = content.includes('![');
    
    if (hasImageMarkdown) {
      return (
        <ReactMarkdown
          components={{
            img: ({ node, ...props }) => (
              <div className="mt-2 overflow-hidden rounded-md">
                <img 
                  {...props}
                  className="w-full h-auto object-cover transition-opacity duration-500 opacity-100"
                  loading="lazy"
                  onLoad={(e) => {
                    // Remove shimmer effect once image loads
                    e.currentTarget.classList.remove('opacity-0');
                  }}
                  style={{ maxHeight: '300px' }}
                />
              </div>
            ),
            p: ({ node, children, ...props }) => <p className="mb-2" {...props}>{children}</p>,
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

  const ShimmerEffect = () => (
    <div className="animate-pulse space-y-2">
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-2 bg-gray-300 dark:bg-gray-700 rounded w-5/6"></div>
    </div>
  );

  // Helper function to log message properties (for debugging)
  const logMessageProps = (message: ChatMessage) => {
    console.log("Message props:", {
      id: message.id,
      hasModeSwitchAction: !!message.modeSwitchAction,
      modeSwitchAction: message.modeSwitchAction,
      hasActionButtons: !!message.actionButtons
    });
  };

  return (
    <div className="flex-1 overflow-y-auto py-4 px-4 pb-16">
      <div className="max-w-md mx-auto space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            const styles = getMessageStyle(message);
            const isLastMessage = index === messages.length - 1;
            
            // Log message properties to help with debugging
            if (isLastMessage) {
              logMessageProps(message);
            }
            
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
                    <div
                      className={`${styles?.bgColor} ${styles?.textColor} p-3 rounded-2xl ${isAssistant ? 'rounded-tl-none' : 'rounded-tr-none'}`}
                      style={{ 
                        borderLeft: isAssistant ? `2px solid ${styles?.borderColor}` : 'none',
                        borderRight: !isAssistant ? `2px solid ${styles?.borderColor}` : 'none'
                      }}
                    >
                      {message.isLoading ? (
                        <ShimmerEffect />
                      ) : renderMessageContent(message.content)}
                    </div>
                    
                    {/* Action Buttons */}
                    {message.actionButtons && (
                      <div className={`flex gap-2 mt-1 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        {message.actionButtons.secondary && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onConfirm(message.id, message.actionButtons?.secondary?.action || '')}
                            className="text-xs py-1 h-8"
                          >
                            {message.actionButtons.secondary.text}
                          </Button>
                        )}
                        {message.actionButtons.primary && (
                          <Button 
                            variant="default"
                            size="sm"
                            onClick={() => onConfirm(message.id, message.actionButtons?.primary?.action || '')}
                            className="text-xs py-1 h-8"
                            style={{ 
                              backgroundColor: styles?.borderColor,
                              borderColor: styles?.borderColor
                            }}
                          >
                            {message.actionButtons.primary.text}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    {/* Mode Switch Button - Enhanced visibility and debugging */}
                    {message.modeSwitchAction && (
                      <div className="flex justify-start mt-2">
                        <Button 
                          variant="default"
                          size="sm"
                          onClick={() => onConfirm(message.id, message.modeSwitchAction?.action || '')}
                          className="text-xs py-1 h-8 px-3 animate-pulse"
                          style={{ 
                            backgroundColor: getModeColor(message.modeSwitchAction.targetMode),
                            borderColor: getModeColor(message.modeSwitchAction.targetMode),
                          }}
                        >
                          {message.modeSwitchAction.text}
                        </Button>
                      </div>
                    )}
                    
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
