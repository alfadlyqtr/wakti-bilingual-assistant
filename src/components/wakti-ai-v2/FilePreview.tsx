
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Image, FileText, Eye, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UploadedFile } from '@/hooks/useFileUpload';
import { OptimizedUploadedFile } from '@/hooks/useOptimizedFileUpload';

interface FilePreviewProps {
  file: UploadedFile | OptimizedUploadedFile;
  index: number;
  onRemove: (index: number) => void;
  showRemoveButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function FilePreview({ 
  file, 
  index, 
  onRemove, 
  showRemoveButton = true,
  size = 'md'
}: FilePreviewProps) {
  const [showModal, setShowModal] = useState(false);
  
  const isImage = file.type.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  const isText = file.type === 'text/plain';
  
  // Handle both optimized and regular uploads
  const imageUrl = 'publicUrl' in file ? file.publicUrl : file.url;
  const thumbnailUrl = 'thumbnail' in file ? file.thumbnail : ('preview' in file ? file.preview : imageUrl);
  
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20',
    lg: 'w-24 h-24'
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  return (
    <>
      <div className="relative group">
        <div className={`${sizeClasses[size]} border-2 border-border rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center relative`}>
          {/* Image Preview */}
          {isImage && thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={file.name}
              className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setShowModal(true)}
              onError={(e) => {
                // Fallback to main URL if thumbnail fails
                if (e.currentTarget.src !== imageUrl) {
                  e.currentTarget.src = imageUrl;
                }
              }}
            />
          )}
          
          {/* PDF Icon */}
          {isPDF && (
            <div className="flex flex-col items-center justify-center text-red-500">
              <FileText className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">PDF</span>
            </div>
          )}
          
          {/* Text File Icon */}
          {isText && (
            <div className="flex flex-col items-center justify-center text-blue-500">
              <FileText className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">TXT</span>
            </div>
          )}
          
          {/* Generic File Icon */}
          {!isImage && !isPDF && !isText && (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-6 w-6 mb-1" />
              <span className="text-xs font-medium">FILE</span>
            </div>
          )}
          
          {/* Hover Actions */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
            {isImage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-white hover:bg-white/20"
                onClick={() => setShowModal(true)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-white hover:bg-white/20"
              onClick={handleDownload}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
          
          {/* Remove Button */}
          {showRemoveButton && (
            <Button
              size="icon"
              variant="ghost"
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemove(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {/* File Name */}
        <div className="mt-1 text-xs text-center">
          <div className="truncate max-w-20" title={file.name}>
            {file.name}
          </div>
          <div className="text-muted-foreground">
            {formatFileSize(file.size)}
          </div>
        </div>
      </div>

      {/* Full Size Image Modal */}
      {isImage && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>{file.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDownload}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center">
              <img
                src={imageUrl}
                alt={file.name}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
