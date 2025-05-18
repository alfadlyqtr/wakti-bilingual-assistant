
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

// Enhanced image utils hook with animations and transitions
export const useImageUtils = () => {
  // Image modal states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImagePrompt, setSelectedImagePrompt] = useState<string | null>(null);
  const [selectedImageTime, setSelectedImageTime] = useState<Date | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Trigger image download with error handling
  const downloadImage = async (imageUrl: string, promptText: string = "wakti-image") => {
    try {
      setImageLoading(true);
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
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
      toast.success("Image downloaded successfully");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    } finally {
      setImageLoading(false);
    }
  };

  // Open the image in a modal with improved UX
  const openImageModal = (imageUrl: string, promptText: string = '', timestamp: Date = new Date()) => {
    setSelectedImage(imageUrl);
    setSelectedImagePrompt(promptText);
    setSelectedImageTime(timestamp);
    setShowImageModal(true);
    
    // Preload the image
    const img = new Image();
    img.src = imageUrl;
    setImageLoading(true);
    
    img.onload = () => {
      setImageLoading(false);
    };
    
    img.onerror = () => {
      setImageLoading(false);
      toast.error("Failed to load image");
    };
  };
  
  // Image fade-in animation for smooth appearance
  const imageVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } }
  };
  
  return {
    selectedImage,
    selectedImagePrompt,
    selectedImageTime,
    showImageModal,
    setShowImageModal,
    downloadImage,
    openImageModal,
    imageLoading,
    imageVariants
  };
};

export default useImageUtils;
