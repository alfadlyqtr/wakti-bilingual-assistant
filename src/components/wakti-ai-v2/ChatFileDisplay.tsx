
import React from 'react';
import { FileText, Image, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/providers/ThemeProvider';

interface ChatFileDisplayProps {
  files: any[];
  size?: 'sm' | 'md';
}

export function ChatFileDisplay({ files, size = 'sm' }: ChatFileDisplayProps) {
  const { language } = useTheme();

  if (!files || files.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const handleDownload = async (file: any) => {
    try {
      const response = await fetch(file.url);
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

  const sizeClasses = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/40 rounded-lg max-w-[200px]"
          >
            {/* File Icon */}
            <div className="flex-shrink-0 text-muted-foreground">
              {file.type?.startsWith('image/') && file.thumbnail ? (
                <img
                  src={file.thumbnail}
                  alt={file.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : (
                getFileIcon(file.type || '')
              )}
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-foreground truncate ${sizeClasses}`}>
                {file.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(file.size || 0)}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              {file.type?.startsWith('image/') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => window.open(file.url, '_blank')}
                  title={language === 'ar' ? 'عرض' : 'View'}
                >
                  <Eye className={iconSize} />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleDownload(file)}
                title={language === 'ar' ? 'تحميل' : 'Download'}
              >
                <Download className={iconSize} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
