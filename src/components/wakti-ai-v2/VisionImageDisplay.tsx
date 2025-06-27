
import React from 'react';
import { VisionUploadedFile } from '@/hooks/useVisionFileUpload';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VisionImageDisplayProps {
  files: VisionUploadedFile[];
  onRemoveFile?: (fileId: string) => void;
  showRemoveButton?: boolean;
}

export function VisionImageDisplay({ 
  files, 
  onRemoveFile, 
  showRemoveButton = false 
}: VisionImageDisplayProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((file) => (
        <div key={file.id} className="relative group">
          <img
            src={file.publicUrl}
            alt={file.name}
            className="w-16 h-16 object-cover rounded-lg border shadow-sm"
          />
          {showRemoveButton && onRemoveFile && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onRemoveFile(file.id)}
              className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
