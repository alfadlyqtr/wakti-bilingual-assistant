
import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface ImageModalProps {
  showImageModal: boolean;
  setShowImageModal: (show: boolean) => void;
  selectedImage: string | null;
  selectedImagePrompt: string | null;
  selectedImageTime: Date | null;
  downloadImage: (imageUrl: string, promptText: string) => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  showImageModal,
  setShowImageModal,
  selectedImage,
  selectedImagePrompt,
  selectedImageTime,
  downloadImage
}) => {
  return (
    <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
      <DialogContent className="w-full max-w-3xl p-0 bg-transparent border-0 shadow-none">
        <div className="relative w-full flex flex-col items-center">
          {selectedImage && (
            <>
              <div className="bg-black/80 backdrop-blur-sm rounded-lg p-5 w-full">
                <img
                  src={selectedImage}
                  alt="Full-size image"
                  className="w-full h-auto rounded-lg mx-auto"
                />
                
                <div className="mt-4 text-white">
                  {selectedImagePrompt && (
                    <p className="text-sm font-medium mb-1">{selectedImagePrompt}</p>
                  )}
                  {selectedImageTime && (
                    <p className="text-xs text-gray-400">
                      Generated on {selectedImageTime.toLocaleDateString()} at {selectedImageTime.toLocaleTimeString()}
                    </p>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={() => downloadImage(selectedImage, selectedImagePrompt || '')}
                    className="bg-black/30 hover:bg-black/50 text-white transition-colors duration-200"
                  >
                    <Download className="mr-1 h-4 w-4" /> Download Image
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;
