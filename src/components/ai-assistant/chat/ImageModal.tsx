
import React from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';
import { TranslationKey } from '@/utils/translationTypes';

interface ImageModalProps {
  isVisible: boolean;
  onClose: () => void;
  imageUrl: string | null;
  promptText: string | null;
  timestamp: Date | null;
  onDownload: (url: string, prompt: string) => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  isVisible, 
  onClose, 
  imageUrl, 
  promptText, 
  timestamp, 
  onDownload
}) => {
  const { language } = useTheme();

  // Format date according to user's language
  const formatDate = (date: Date) => {
    return format(date, 'PPpp', { 
      locale: language === 'ar' ? ar : enUS
    });
  };

  // Handle download click
  const handleDownload = () => {
    if (imageUrl && promptText) {
      onDownload(imageUrl, promptText);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && imageUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-semibold text-lg">
                {t("generatedImage" as TranslationKey, language)}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  title={t("download" as TranslationKey, language)}
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            {/* Image Container */}
            <div className="flex-1 overflow-auto">
              <div className="relative">
                <img 
                  src={imageUrl} 
                  alt={promptText || t("generatedImage" as TranslationKey, language)} 
                  className="w-full h-auto object-contain"
                />
              </div>
            </div>
            
            {/* Footer - Prompt and Date info */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              {promptText && (
                <p className="mb-2 text-sm font-medium">
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {t("prompt" as TranslationKey, language)}:
                  </span>{" "}
                  {promptText}
                </p>
              )}
              {timestamp && (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDate(timestamp)}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageModal;
