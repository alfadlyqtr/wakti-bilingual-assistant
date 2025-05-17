import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AIMode, ChatMessage } from "./types";
import { Loader2, Download, Expand } from "lucide-react";
import { t } from "@/utils/translations";
import { TranslationKey } from "@/utils/translationTypes";
import ReactMarkdown from 'react-markdown';
import { Skeleton } from "@/components/ui/skeleton";
import { modeController } from "@/utils/modeController";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
  
  // Image modal states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImagePrompt, setSelectedImagePrompt] = useState<string | null>(null);
  const [selectedImageTime, setSelectedImageTime] = useState<Date | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

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
  // Track if we're ready to show images (active mode is creative)
  const [isCreativeModeActive, setIsCreativeModeActive] = useState(activeMode === 'creative');

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

  // Trigger image download
  const downloadImage = async (imageUrl: string, promptText: string = "wakti-image") => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a sanitized filename from the prompt
      const sanitizedPrompt = promptText
        .replace(/[^a-z0-9]/gi, '_')
        .toLowerCase()
        .substring(0, 50); // Limit to 50 chars
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${sanitizedPrompt}.png`;
      
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  // Open the image in a modal
  const openImageModal = (imageUrl: string, promptText: string = '', timestamp: Date = new Date()) => {
    setSelectedImage(imageUrl);
    setSelectedImagePrompt(promptText);
    setSelectedImageTime(timestamp);
    setShowImageModal(true);
  };

  // Extract prompt text from message content
  const extractPromptFromContent = (content: string): string => {
    // Look for markdown image syntax ![...](...)
    const imgRegex = /!\[([^\]]*)\]\([^)]+\)/;
    const match = content.match(imgRegex);
    
    if (match && match[1]) {
      return match[1];
    }
    
    // If no match, try to find any text before the image
    const lines = content.split('\n');
    const textLines = lines.filter(line => !line.startsWith('![') && line.trim() !== '');
    
    if (textLines.length > 0) {
      return textLines[0];
    }
    
    return "Generated Image";
  };

  // Function to render message content with markdown support and image loading states
  const renderMessageContent = (content: string, messageId: string, message: ChatMessage) => {
    // Don't render images until we're in the correct mode for the message
    const hasImageMarkdown = content.includes('![');
    
    if (hasImageMarkdown) {
      // Extract the prompt for download filename
      const promptText = extractPromptFromContent(content);
      
      return (
        <ReactMarkdown
          components={{
            img: ({ node, ...props }) => {
              const imageUrl = props.src || '';
              
              // Only start loading when we're in creative mode AND the URL is valid
              const shouldStartLoading = isCreativeModeActive && 
                imageUrl.startsWith('http') && 
                !isSwitchingMode;
              
              // Set this message's image as loading when first encountered
              if (shouldStartLoading && !loadingImages.hasOwnProperty(messageId)) {
                setLoadingImages(prev => ({...prev, [messageId]: true}));
              }
              
              return (
                <div className="relative mt-2 overflow-hidden rounded-md">
                  {/* Shimmer effect - only show when in creative mode and image is loading */}
                  {(shouldStartLoading && loadingImages[messageId]) && (
                    <Skeleton className="w-full h-64 animate-pulse bg-zinc-300 dark:bg-zinc-700" />
                  )}
                  
                  {/* Only render the image when we're ready to show it */}
                  {shouldStartLoading && (
                    <div className="relative group">
                      <img 
                        {...props}
                        className={`w-full h-auto object-cover rounded-md transition-opacity duration-300 ${
                          loadingImages[messageId] ? 'opacity-0' : 'opacity-100'
                        }`}
                        loading="lazy"
                        onLoad={(e) => {
                          // Add a small delay before showing image for smoother transition
                          setTimeout(() => {
                            setLoadingImages(prev => ({...prev, [messageId]: false}));
                          }, 250); // 250ms buffer for smoother transition
                        }}
                        style={{ maxHeight: '300px' }}
                        onClick={() => openImageModal(imageUrl, promptText, message.timestamp)}
                      />
                      
                      {/* Fixed position action buttons to prevent flickering on hover */}
                      <div className="absolute bottom-2 right-2 flex gap-2 transition-opacity duration-300 
                                      opacity-0 group-hover:opacity-100 bg-black/5 backdrop-blur-sm 
                                      p-1 rounded-full">
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full
                                    transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadImage(imageUrl, promptText);
                          }}
                        >
                          <Download className="h-4 w-4" />
                          <span className="sr-only">Download</span>
                        </Button>
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full
                                    transition-colors duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            openImageModal(imageUrl, promptText, message.timestamp);
                          }}
                        >
                          <Expand className="h-4 w-4" />
                          <span className="sr-only">Expand</span>
                        </Button>
                      </div>
                    </div>
                  )}
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
        
        {/* Enhanced image viewer modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="w-full max-w-3xl p-0 bg-transparent border-0 shadow-none">
            <div className="relative w-full flex flex-col items-center">
              {selectedImage && (
                <>
                  <div className="bg-black/80 backdrop-blur-sm rounded-lg p-5 w-full">
                    <img
                      src={selectedImage}
                      alt="Full-size image"
                      className="w-full h-auto rounded-lg mx-auto"
                    />
                    
                    <div className="mt-4 text-white">
                      {selectedImagePrompt && (
                        <p className="text-sm font-medium mb-1">{selectedImagePrompt}</p>
                      )}
                      {selectedImageTime && (
                        <p className="text-xs text-gray-400">
                          Generated on {selectedImageTime.toLocaleDateString()} at {selectedImageTime.toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button
                        onClick={() => downloadImage(selectedImage, selectedImagePrompt || '')}
                        className="bg-black/30 hover:bg-black/50 text-white transition-colors duration-200"
                      >
                        <Download className="mr-1 h-4 w-4" /> Download Image
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        {/* This empty div is for auto-scrolling to the bottom of chat */}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
};
