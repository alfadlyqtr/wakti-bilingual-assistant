
import React, { useRef, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { AIMode, ChatMessage } from "./types";
import ChatMessageComponent from "./chat/ChatMessage";
import TypingIndicator from "./chat/TypingIndicator";
import ModeSwitchIndicator from "./chat/ModeSwitchIndicator";
import ImageModal from "./chat/ImageModal";
import { useMessageStyles } from "./chat/useMessageStyles";
import { useImageUtils } from "./chat/useImageUtils";
import { useModeSwitching } from "./chat/useModeSwitching";

interface ChatWindowProps {
  messages: ChatMessage[];
  isTyping: boolean;
  activeMode: AIMode;
  getModeColor: (mode: AIMode) => string;
  onConfirm: (messageId: string, action: string) => void;
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
  language,
  theme,
  setActiveMode
}) => {
  const messageEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      hour: 'numeric',
      minute: 'numeric',
    }).format(timestamp);
  };

  // Get message styles
  const { getMessageStyle } = useMessageStyles(theme);
  
  // Image utilities
  const {
    selectedImage,
    selectedImagePrompt,
    selectedImageTime,
    showImageModal,
    setShowImageModal,
    downloadImage,
    openImageModal
  } = useImageUtils();
  
  // Mode switching logic
  const {
    isSwitchingMode,
    lastSwitchedMode,
    isCreativeModeActive,
    getModeName
  } = useModeSwitching({ activeMode, messages, onConfirm, setActiveMode });

  return (
    <div className="flex-1 overflow-y-auto py-4 px-4 pb-16">
      <div className="max-w-md mx-auto space-y-4">
        <AnimatePresence>
          {messages.map((message, index) => {
            const isAssistant = message.role === 'assistant';
            const styles = getMessageStyle(message);
            const isLastMessage = index === messages.length - 1;
            
            return (
              <ChatMessageComponent
                key={message.id}
                message={message}
                isAssistant={isAssistant}
                isLastMessage={isLastMessage}
                styles={styles}
                isCreativeModeActive={isCreativeModeActive}
                formatTimestamp={formatTimestamp}
                openImageModal={openImageModal}
                downloadImage={downloadImage}
                onConfirm={onConfirm}
              />
            );
          })}
        </AnimatePresence>
        
        {/* Typing indicator with adjusted spacing */}
        <TypingIndicator isTyping={isTyping} />
        
        {/* Mode switch animation indicator */}
        <ModeSwitchIndicator 
          isVisible={isSwitchingMode}
          targetMode={lastSwitchedMode}
          language={language as "en" | "ar"}
          theme={theme as "light" | "dark"}
        />
        
        {/* Enhanced image viewer modal */}
        <ImageModal 
          isVisible={showImageModal}
          onClose={() => setShowImageModal(false)}
          imageUrl={selectedImage}
          promptText={selectedImagePrompt}
          timestamp={selectedImageTime}
          onDownload={downloadImage}
        />
        
        {/* This empty div is for auto-scrolling to the bottom of chat */}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
};

export default ChatWindow;
