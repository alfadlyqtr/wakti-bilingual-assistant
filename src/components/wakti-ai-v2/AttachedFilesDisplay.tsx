
import React from 'react';
import { FileText, Image, FileIcon, Download } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';

interface AttachedFile {
  name: string;
  url: string;
  type: string;
  size: number;
  thumbnail?: string;
}

interface AttachedFilesDisplayProps {
  files: AttachedFile[];
}

export function AttachedFilesDisplay({ files }: AttachedFilesDisplayProps) {
  const { language } = useTheme();

  if (!files || files.length === 0) return null;

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return Image;
    if (type === 'application/pdf') return FileText;
    return FileIcon;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mb-2 space-y-1">
      {files.map((file, index) => {
        const FileIconComponent = getFileIcon(file.type);
        const isImage = file.type.startsWith('image/');
        
        return (
          <div
            key={index}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border/50 text-xs"
          >
            {isImage && file.thumbnail ? (
              <img
                src={file.thumbnail}
                alt={file.name}
                className="w-8 h-8 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileIconComponent className="h-4 w-4 text-primary" />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-foreground">
                {file.name}
              </div>
              <div className="text-muted-foreground">
                {formatFileSize(file.size)}
              </div>
            </div>
            
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
              title={language === 'ar' ? 'تحميل الملف' : 'Download file'}
            >
              <Download className="h-3 w-3" />
            </a>
          </div>
        );
      })}
    </div>
  );
}
