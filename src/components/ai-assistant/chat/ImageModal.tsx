
import React from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { formatDistanceToNow } from 'date-fns';
import { arAR, enUS } from 'date-fns/locale';
import { toast } from "sonner";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  prompt: string | null;
  timestamp: Date | null;
  onDownload: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  prompt,
  timestamp,
  onDownload
}) => {
  const { theme, language } = useTheme();
  
  const handleShare = async () => {
    if (!imageUrl) return;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'WAKTI Generated Image',
          text: prompt || 'Check out this AI-generated image!',
          url: imageUrl,
        });
      } else {
        // Fallback: Copy URL to clipboard
        await navigator.clipboard.writeText(imageUrl);
        toast.success(language === 'ar' ? 'تم نسخ عنوان الصورة إلى الحافظة' : 'Image URL copied to clipboard');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
    }
  };
  
  const formatTime = (date: Date | null) => {
    if (!date) return '';
    
    return formatDistanceToNow(date, { 
      addSuffix: true,
      locale: language === 'ar' ? arAR : enUS
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90vw] max-h-[90vh] flex flex-col p-0 gap-0 bg-black dark:bg-black">
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleShare}
            className="bg-black/60 text-white border-gray-600 hover:bg-black/80 rounded-full"
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onDownload}
            className="bg-black/60 text-white border-gray-600 hover:bg-black/80 rounded-full"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onClose} 
            className="bg-black/60 text-white border-gray-600 hover:bg-black/80 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Image container with proper sizing */}
        <div className="flex items-center justify-center flex-1 w-full overflow-auto">
          {imageUrl && (
            <motion.img 
              src={imageUrl} 
              alt={prompt || 'Generated image'} 
              className="max-w-full max-h-[70vh] object-contain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </div>
        
        {/* Image info footer */}
        <div className="bg-black/80 p-4 text-white">
          {prompt && (
            <p className="text-sm mb-1 font-medium">
              {prompt}
            </p>
          )}
          {timestamp && (
            <p className="text-xs text-gray-400">
              {formatTime(timestamp)}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;
