
import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AIMode, ChatMessage as ChatMessageType } from "../types";
import MessageContent from "./MessageContent";

interface ChatMessageProps {
  message: ChatMessageType;
  isAssistant: boolean;
  isLastMessage: boolean;
  styles: { bgColor: string; textColor: string; borderColor: string } | undefined;
  isCreativeModeActive: boolean;
  isSwitchingMode: boolean;
  getModeName: (mode: AIMode) => string;
  formatTimestamp: (timestamp: Date) => string;
  openImageModal: (imageUrl: string, promptText: string, timestamp: Date) => void;
  downloadImage: (imageUrl: string, promptText: string) => void;
  onConfirm: (messageId: string, action: string) => void;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({
  message,
  isAssistant,
  isLastMessage,
  styles,
  isCreativeModeActive,
  isSwitchingMode,
  getModeName,
  formatTimestamp,
  openImageModal,
  downloadImage,
  onConfirm
}) => {
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
            ) : (
              <MessageContent
                content={message.content}
                messageId={message.id}
                message={message}
                isCreativeModeActive={isCreativeModeActive}
                isSwitchingMode={isSwitchingMode}
                openImageModal={openImageModal}
                downloadImage={downloadImage}
                onConfirm={onConfirm}
              />
            )}
          </div>
          
          <span className="text-xs text-muted-foreground self-end">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
      </div>
    </motion.div>
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

export default ChatMessageComponent;
