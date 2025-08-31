export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  preview?: string;
  base64?: string;
  imageType?: {
    id: string;
    name: string;
  };
}

export interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  onRemoveFile: (fileId: string) => void;
  uploadedFiles: UploadedFile[];
  isUploading: boolean;
  disabled?: boolean;
  maxFiles?: number;
  // Optional props for SimplifiedFileUpload
  onUpdateFiles?: (files: UploadedFile[]) => void;
  onAutoSwitchMode?: (mode: string) => void;
}
