import React from 'react';
import { FileUp, Download, Trash2, Image, FileText, File, Video, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface UploadedFile {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

interface BackendUploadsProps {
  uploads: UploadedFile[];
  totalSize: number;
  isRTL: boolean;
  onDownload: (upload: UploadedFile) => void;
  onDelete: (id: string) => void;
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return File;
  if (fileType.startsWith('image/')) return Image;
  if (fileType.startsWith('video/')) return Video;
  if (fileType.startsWith('audio/')) return Music;
  if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
  return File;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function BackendUploads({ uploads, totalSize, isRTL, onDownload, onDelete }: BackendUploadsProps) {
  if (uploads.length === 0) {
    return (
      <div className="p-8 text-center">
        <FileUp className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">
          {isRTL ? 'لا توجد ملفات مرفوعة' : 'No uploaded files yet'}
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          {isRTL ? 'ستظهر هنا الملفات المرفوعة من المستخدمين' : 'User uploaded files will appear here'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Storage Usage */}
      <div className={cn(
        "flex items-center justify-between p-3 rounded-lg bg-muted/30 dark:bg-white/5",
        isRTL && "flex-row-reverse"
      )}>
        <span className="text-xs text-muted-foreground">
          {isRTL ? 'المساحة المستخدمة' : 'Storage Used'}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {formatFileSize(totalSize)}
        </span>
      </div>

      {/* File Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {uploads.map((upload) => {
          const Icon = getFileIcon(upload.file_type);
          
          return (
            <div 
              key={upload.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border/50 dark:border-white/10 bg-card/50 dark:bg-white/5 hover:border-indigo-500/30 transition-colors"
            >
              <div className="p-2 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 shrink-0">
                <Icon className="h-5 w-5 text-indigo-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {upload.filename}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(upload.size_bytes)} • {format(new Date(upload.uploaded_at), 'MMM d')}
                </p>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onDownload(upload)}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  onClick={() => onDelete(upload.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
