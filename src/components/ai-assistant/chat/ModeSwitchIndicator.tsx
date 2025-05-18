
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { AIMode, ASSISTANT_MODES } from '../types';
import { useTheme } from '@/providers/ThemeProvider';

interface ModeSwitchIndicatorProps {
  isVisible: boolean;
  targetMode: AIMode | null;
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

export const ModeSwitchIndicator: React.FC<ModeSwitchIndicatorProps> = ({
  isVisible,
  targetMode,
  language,
  theme
}) => {
  // Get mode info
  const getModeInfo = () => {
    if (!targetMode) return null;
    return ASSISTANT_MODES.find(m => m.id === targetMode);
  };

  // Get color based on mode
  const getColor = () => {
    const mode = getModeInfo();
    if (!mode) return '#3498db';
    
    const colorKey = theme === 'dark' ? 'dark' : 'light';
    return mode.color[colorKey];
  };

  // Get localized mode name
  const getModeName = () => {
    const mode = getModeInfo();
    if (!mode) return targetMode || 'unknown';
    
    return mode.label[language];
  };

  // Get localized text for switching message
  const getSwitchingText = () => {
    if (language === 'ar') {
      return `جاري التبديل إلى وضع ${getModeName()}...`;
    }
    return `Switching to ${getModeName()} mode...`;
  };

  return (
    <AnimatePresence>
      {isVisible && targetMode && (
        <motion.div
          className="fixed top-20 left-0 right-0 z-50 flex justify-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div 
            className="bg-white dark:bg-zinc-800 shadow-lg rounded-full px-4 py-2 flex items-center gap-2"
            style={{ 
              borderLeft: `4px solid ${getColor()}`, 
              direction: language === 'ar' ? 'rtl' : 'ltr'
            }}
          >
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: getColor() }} />
            <span className="text-sm font-medium">
              {getSwitchingText()}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ModeSwitchIndicator;
