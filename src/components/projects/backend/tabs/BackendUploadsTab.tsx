import React, { useState, useCallback } from 'react';
import { Upload, FileImage, FileText, File, Download, Trash2, Eye, X, ImageIcon, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UploadedFile {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
}

interface BackendUploadsTabProps {
  uploads: UploadedFile[];
  projectId: string;
  isRTL: boolean;
  onRefresh: () => void;
}

export function BackendUploadsTab({ uploads, projectId, isRTL, onRefresh }: BackendUploadsTabProps) {
  const [uploading, setUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalSize = uploads.reduce((sum, u) => sum + (u.size_bytes || 0), 0);
  const maxSize = 50 * 1024 * 1024; // 50MB limit
  const usagePercent = (totalSize / maxSize) * 100;

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return File;
    if (fileType.startsWith('image/')) return FileImage;
    if (fileType.includes('pdf') || fileType.includes('document')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isImage = (fileType: string | null) => fileType?.startsWith('image/');

  const getPublicUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('project-uploads').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      for (const file of acceptedFiles) {
        // Path format enforced by storage RLS policies:
        //   {userId}/{projectId}/{timestamp}-{filename}
        const storagePath = `${user.id}/${projectId}/${Date.now()}-${file.name}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('project-uploads')
          .upload(storagePath, file);
        
        if (uploadError) throw uploadError;

        // Save to database
        const { error: dbError } = await supabase
          .from('project_uploads')
          .insert({
            project_id: projectId,
            user_id: user.id,
            filename: file.name,
            storage_path: storagePath,
            file_type: file.type,
            size_bytes: file.size,
          });
        
        if (dbError) throw dbError;
      }

      toast.success(isRTL ? 'تم رفع الملفات!' : 'Files uploaded!');
      onRefresh();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || (isRTL ? 'فشل الرفع' : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  }, [projectId, isRTL, onRefresh]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.css', '.js', '.json'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB per file
  });

  const handleDownload = (upload: UploadedFile) => {
    const url = getPublicUrl(upload.storage_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = upload.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (upload: UploadedFile) => {
    setDeletingId(upload.id);
    try {
      // Delete from storage
      await supabase.storage.from('project-uploads').remove([upload.storage_path]);
      
      // Delete from database
      const { error } = await supabase
        .from('project_uploads')
        .delete()
        .eq('id', upload.id);
      
      if (error) throw error;
      
      toast.success(isRTL ? 'تم الحذف' : 'Deleted');
      onRefresh();
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || (isRTL ? 'فشل الحذف' : 'Delete failed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={cn("space-y-6", isRTL && "rtl")}>
      {/* Storage Usage */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border border-border/50">
        <div className={cn("flex items-center justify-between mb-2", isRTL && "flex-row-reverse")}>
          <span className="text-sm font-medium text-foreground">
            {isRTL ? 'التخزين المستخدم' : 'Storage Used'}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatFileSize(totalSize)} / 50 MB
          </span>
        </div>
        <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary via-accent to-secondary transition-all duration-500"
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300",
          isDragActive 
            ? "border-primary bg-primary/10 scale-[1.02]" 
            : "border-border/50 hover:border-primary/50 hover:bg-primary/5",
          uploading && "opacity-50 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300",
            isDragActive 
              ? "bg-primary text-primary-foreground scale-110" 
              : "bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20 text-primary"
          )}>
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">
              {uploading 
                ? (isRTL ? 'جاري الرفع...' : 'Uploading...')
                : isDragActive 
                  ? (isRTL ? 'أفلت الملفات هنا' : 'Drop files here')
                  : (isRTL ? 'اسحب الملفات أو انقر للرفع' : 'Drag files or click to upload')
              }
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isRTL ? 'صور، PDF، ملفات (حتى 10MB)' : 'Images, PDFs, files (up to 10MB)'}
            </p>
          </div>
        </div>
      </div>

      {/* Files Grid */}
      {uploads.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">
            {isRTL ? 'لا توجد ملفات مرفوعة بعد' : 'No files uploaded yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {uploads.map((upload) => {
            const FileIcon = getFileIcon(upload.file_type);
            const isImg = isImage(upload.file_type);
            const publicUrl = getPublicUrl(upload.storage_path);

            return (
              <div
                key={upload.id}
                className="group relative bg-card rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all duration-300"
              >
                {/* Preview/Thumbnail */}
                <div 
                  className="aspect-square bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center cursor-pointer"
                  onClick={() => isImg && setPreviewFile(upload)}
                >
                  {isImg ? (
                    <img 
                      src={publicUrl} 
                      alt={upload.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <FileIcon className="h-12 w-12 text-muted-foreground/50" />
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-sm font-medium text-foreground truncate" title={upload.filename}>
                    {upload.filename}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFileSize(upload.size_bytes)}
                  </p>
                </div>

                {/* Actions Overlay */}
                <div className={cn(
                  "absolute inset-0 bg-background/90 backdrop-blur-sm flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                  isRTL && "flex-row-reverse"
                )}>
                  {isImg && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-10 w-10 rounded-xl bg-primary/10 hover:bg-primary/20"
                      onClick={() => setPreviewFile(upload)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-xl bg-accent/10 hover:bg-accent/20"
                    onClick={() => handleDownload(upload)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive"
                    onClick={() => handleDelete(upload)}
                    disabled={deletingId === upload.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden" title={previewFile?.filename || 'Image Preview'}>
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="truncate">{previewFile?.filename}</DialogTitle>
          </DialogHeader>
          {previewFile && (
            <div className="relative">
              <img
                src={getPublicUrl(previewFile.storage_path)}
                alt={previewFile.filename}
                className="w-full max-h-[70vh] object-contain bg-muted/20"
              />
              <div className="absolute bottom-4 right-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleDownload(previewFile)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isRTL ? 'تحميل' : 'Download'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
