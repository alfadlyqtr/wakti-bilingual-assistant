
import React from "react";
import { motion } from "framer-motion";
import { AIMode } from "../types";

interface ModeSwitchIndicatorProps {
  isSwitchingMode: boolean;
  lastSwitchedMode: AIMode | null;
  getModeName: (mode: AIMode) => string;
}

const ModeSwitchIndicator: React.FC<ModeSwitchIndicatorProps> = ({ 
  isSwitchingMode, 
  lastSwitchedMode,
  getModeName 
}) => {
  if (!isSwitchingMode || !lastSwitchedMode) return null;

  return (
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
  );
};

export default ModeSwitchIndicator;
