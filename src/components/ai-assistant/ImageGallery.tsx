
import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Expand, Calendar } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getUserImages, ImageRecord } from '@/services/imageService';
import { Skeleton } from '@/components/ui/skeleton';

interface ImageGalleryProps {
  userId: string;
}

const ImageGallery = ({ userId }: ImageGalleryProps) => {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  useEffect(() => {
    const fetchImages = async () => {
      if (!userId) return;
      
      try {
        setLoading(true);
        const userImages = await getUserImages(userId, 50);
        setImages(userImages);
      } catch (error) {
        console.error('Error fetching images:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [userId]);

  // Trigger image download
  const downloadImage = async (image: ImageRecord) => {
    try {
      const response = await fetch(image.image_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Create a sanitized filename from the prompt
      const sanitizedPrompt = image.prompt
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

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground mb-2">No images yet</p>
        <p className="text-xs text-muted-foreground">Images you create will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {images.map((image) => (
          <Card key={image.id} className="overflow-hidden group">
            <CardContent className="p-0 relative">
              <img 
                src={image.image_url} 
                alt={image.prompt} 
                className="w-full h-32 object-cover"
                onClick={() => {
                  setSelectedImage(image);
                  setShowImageModal(true);
                }}
              />
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-2">
                <p className="text-white text-xs truncate mb-2">{image.prompt}</p>
                
                <div className="flex justify-between items-center">
                  <span className="text-white/80 text-xs flex items-center">
                    <Calendar size={12} className="mr-1" />
                    {formatDate(image.created_at)}
                  </span>
                  
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-white rounded-full hover:bg-white/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadImage(image);
                      }}
                    >
                      <Download className="h-3 w-3" />
                      <span className="sr-only">Download</span>
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-white rounded-full hover:bg-white/20"
                      onClick={() => {
                        setSelectedImage(image);
                        setShowImageModal(true);
                      }}
                    >
                      <Expand className="h-3 w-3" />
                      <span className="sr-only">Expand</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Image viewer modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="w-full max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {selectedImage && (
            <div className="bg-black/80 backdrop-blur-sm rounded-lg p-5 w-full">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.prompt}
                className="w-full h-auto rounded-lg mx-auto"
              />
              
              <div className="mt-4 text-white">
                <p className="text-sm font-medium mb-1">{selectedImage.prompt}</p>
                <p className="text-xs text-gray-400">
                  Generated on {formatDate(selectedImage.created_at)}
                </p>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={() => downloadImage(selectedImage)}
                  className="bg-black/30 hover:bg-black/50 text-white"
                >
                  <Download className="mr-1 h-4 w-4" /> Download Image
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageGallery;
