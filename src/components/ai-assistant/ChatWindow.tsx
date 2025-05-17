
import React, { useEffect } from "react";
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
                isSwitchingMode={isSwitchingMode}
                getModeName={getModeName}
                formatTimestamp={formatTimestamp}
                openImageModal={openImageModal}
                downloadImage={downloadImage}
              />
            );
          })}
        </AnimatePresence>
        
        {/* Typing indicator with adjusted spacing */}
        <TypingIndicator isTyping={isTyping} />
        
        {/* Mode switch animation indicator */}
        <ModeSwitchIndicator 
          isSwitchingMode={isSwitchingMode} 
          lastSwitchedMode={lastSwitchedMode}
          getModeName={getModeName}
        />
        
        {/* Enhanced image viewer modal */}
        <ImageModal 
          showImageModal={showImageModal}
          setShowImageModal={setShowImageModal}
          selectedImage={selectedImage}
          selectedImagePrompt={selectedImagePrompt}
          selectedImageTime={selectedImageTime}
          downloadImage={downloadImage}
        />
        
        {/* This empty div is for auto-scrolling to the bottom of chat */}
        <div ref={messageEndRef} />
      </div>
    </div>
  );
};
