
import { useState } from "react";

export const useImageUtils = () => {
  // Image modal states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImagePrompt, setSelectedImagePrompt] = useState<string | null>(null);
  const [selectedImageTime, setSelectedImageTime] = useState<Date | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  
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
  
  return {
    selectedImage,
    selectedImagePrompt,
    selectedImageTime,
    showImageModal,
    setShowImageModal,
    downloadImage,
    openImageModal
  };
};
