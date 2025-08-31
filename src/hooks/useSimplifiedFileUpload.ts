import { useState, useCallback } from 'react';
import { UploadedFile } from '@/types/fileUpload';

export function useSimplifiedFileUpload<T extends UploadedFile = UploadedFile>() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<T[]>([]);

  const handleFilesUploaded = useCallback((newFiles: T[]) => {
    setUploadedFiles(prev => [...prev, ...newFiles] as T[]);
    setIsUploading(false);
  }, []);

  const updateFiles = useCallback((updatedFiles: T[]) => {
    setUploadedFiles(updatedFiles as T[]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId) as T[]);
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
    updateFiles,
    removeFile,
    clearFiles,
    startUploading,
  };
}
