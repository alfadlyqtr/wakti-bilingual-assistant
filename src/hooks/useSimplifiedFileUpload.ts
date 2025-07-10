
import { useState, useCallback } from 'react';
import { SimplifiedUploadedFile } from '@/components/wakti-ai-v2/SimplifiedFileUpload';

export function useSimplifiedFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<SimplifiedUploadedFile[]>([]);

  const handleFilesUploaded = useCallback((newFiles: SimplifiedUploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setIsUploading(false);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  const clearFiles = useCallback(() => {
    setUploadedFiles([]);
  }, []);

  const startUploading = useCallback(() => {
    setIsUploading(true);
  }, []);

  return {
    isUploading,
    uploadedFiles,
    handleFilesUploaded,
    removeFile,
    clearFiles,
    startUploading
  };
}
