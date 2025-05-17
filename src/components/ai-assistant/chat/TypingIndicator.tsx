
import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TypingIndicatorProps {
  isTyping: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isTyping }) => {
  if (!isTyping) return null;

  return (
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
  );
};

export default TypingIndicator;
