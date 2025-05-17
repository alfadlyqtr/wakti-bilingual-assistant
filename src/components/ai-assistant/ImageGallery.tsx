
import React, { useState, useEffect } from 'react';
import { getUserImages, ImageRecord } from '@/services/imageService';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Download, Expand, Calendar } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

interface ImageGalleryProps {
  userId: string;
}

export default function ImageGallery({ userId }: ImageGalleryProps) {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const { language, theme } = useTheme();

  useEffect(() => {
    const fetchImages = async () => {
      if (userId) {
        setLoading(true);
        const userImages = await getUserImages(userId, 20);
        setImages(userImages);
        setLoading(false);
      }
    };

    fetchImages();
  }, [userId]);

  const downloadImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `wakti-image-${Date.now()}.jpg`;
      
      document.body.appendChild(a);
      a.click();
      
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Error downloading image:", error);
    }
  };

  const openImageModal = (image: ImageRecord) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { 
        addSuffix: true,
        locale: language === 'ar' ? ar : enUS
      });
    } catch (error) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-pulse flex flex-col w-full">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>No images generated yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 p-2">
        {images.map((image) => (
          <Card key={image.id} className="overflow-hidden">
            <CardContent className="p-0 relative group">
              <img 
                src={image.image_url} 
                alt={image.prompt}
                className="w-full h-auto object-cover cursor-pointer transition-transform hover:scale-[1.02]"
                style={{ maxHeight: '200px' }}
                onClick={() => openImageModal(image)}
                loading="lazy"
              />
              <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadImage(image.image_url);
                  }}
                >
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download</span>
                </Button>
                <Button 
                  size="icon" 
                  variant="secondary" 
                  className="h-8 w-8 bg-black/30 hover:bg-black/50 text-white rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    openImageModal(image);
                  }}
                >
                  <Expand className="h-4 w-4" />
                  <span className="sr-only">Expand</span>
                </Button>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between p-3">
              <p className="text-sm line-clamp-1 text-gray-700 dark:text-gray-300">{image.prompt}</p>
              <div className="flex items-center text-xs text-gray-500">
                <Calendar className="h-3 w-3 mr-1" />
                {image.created_at && formatTimeAgo(image.created_at)}
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="w-full max-w-3xl p-0 bg-transparent border-0 shadow-none">
          {selectedImage && (
            <div className="relative w-full flex flex-col items-center">
              <img
                src={selectedImage.image_url}
                alt={selectedImage.prompt}
                className="w-full h-auto rounded-lg"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  onClick={() => downloadImage(selectedImage.image_url)}
                  className="bg-black/30 hover:bg-black/50 text-white rounded-full"
                >
                  <Download className="mr-1 h-4 w-4" /> Download
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
