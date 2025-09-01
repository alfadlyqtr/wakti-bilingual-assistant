
import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Paperclip } from "lucide-react";

interface FileUploaderProps {
  onFileUpload: (files: File[]) => void;
  isLoading?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileUpload, isLoading = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (isLoading) return;
    inputRef.current?.click();
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onFileUpload(files);
      // Reset the input so the same file can be selected again if needed
      e.currentTarget.value = '';
    }
  };

  return (
    <div className="flex items-center">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleChange}
        accept="image/*,application/pdf,.txt,.doc,.docx"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleClick}
        disabled={isLoading}
        className="h-9 w-9"
        aria-label="Attach files"
      >
        <Paperclip className="h-5 w-5" />
      </Button>
    </div>
  );
};

