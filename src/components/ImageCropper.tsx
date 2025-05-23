
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface ImageCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageFile: File;
  onCropComplete: (croppedBlob: Blob) => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({
  isOpen,
  onClose,
  imageFile,
  onCropComplete,
}) => {
  const { language } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [imageLoaded, setImageLoaded] = useState(false);
  const [zoom, setZoom] = useState([1]);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const CROP_SIZE = 96; // 96px x 96px final crop size
  const PREVIEW_SIZE = 300; // Preview container size

  useEffect(() => {
    if (isOpen && imageFile) {
      const img = new Image();
      img.onload = () => {
        if (imageRef.current) {
          imageRef.current.src = img.src;
          setImageLoaded(true);
          // Center the crop initially
          setCropPosition({
            x: (PREVIEW_SIZE - CROP_SIZE) / 2,
            y: (PREVIEW_SIZE - CROP_SIZE) / 2,
          });
        }
      };
      img.src = URL.createObjectURL(imageFile);
    }
  }, [isOpen, imageFile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - cropPosition.x,
      y: e.clientY - cropPosition.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Constrain crop circle within preview bounds
    const maxX = PREVIEW_SIZE - CROP_SIZE;
    const maxY = PREVIEW_SIZE - CROP_SIZE;
    
    setCropPosition({
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCrop = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    const img = imageRef.current;
    const zoomValue = zoom[0];
    
    // Calculate source coordinates on the original image
    const scaleX = img.naturalWidth / (PREVIEW_SIZE * zoomValue);
    const scaleY = img.naturalHeight / (PREVIEW_SIZE * zoomValue);
    
    const sourceX = cropPosition.x * scaleX;
    const sourceY = cropPosition.y * scaleY;
    const sourceWidth = CROP_SIZE * scaleX;
    const sourceHeight = CROP_SIZE * scaleY;

    // Draw the cropped portion
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, 'image/jpeg', 0.9);
  };

  const handleCancel = () => {
    setImageLoaded(false);
    setZoom([1]);
    setCropPosition({ x: 0, y: 0 });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>{t("cropProfileImage", language) || "Crop Profile Image"}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Preview Container */}
          <div
            ref={containerRef}
            className="relative mx-auto bg-gray-100 rounded-lg overflow-hidden"
            style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {imageLoaded && (
              <>
                <img
                  ref={imageRef}
                  alt="Crop preview"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{
                    transform: `scale(${zoom[0]})`,
                    transformOrigin: 'top left',
                  }}
                  draggable={false}
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-50" />
                
                {/* Crop Circle */}
                <div
                  className="absolute border-2 border-white rounded-full cursor-move bg-transparent"
                  style={{
                    width: CROP_SIZE,
                    height: CROP_SIZE,
                    left: cropPosition.x,
                    top: cropPosition.y,
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                  }}
                  onMouseDown={handleMouseDown}
                />
              </>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{t("zoom", language) || "Zoom"}</span>
              <span>{Math.round(zoom[0] * 100)}%</span>
            </div>
            <div className="flex items-center space-x-2">
              <ZoomOut className="h-4 w-4" />
              <Slider
                value={zoom}
                onValueChange={setZoom}
                max={3}
                min={0.5}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4" />
            </div>
          </div>

          {/* Instructions */}
          <p className="text-xs text-muted-foreground text-center">
            {t("cropInstructions", language) || "Drag the circle to position your image. Use zoom to adjust the size."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t("cancel", language)}
          </Button>
          <Button onClick={handleCrop} disabled={!imageLoaded}>
            {t("cropAndSave", language) || "Crop & Save"}
          </Button>
        </DialogFooter>

        {/* Hidden canvas for cropping */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
};
