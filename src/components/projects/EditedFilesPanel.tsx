import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export interface EditedFile {
  id: string;
  fileName: string;
  status: 'editing' | 'edited';
}

interface EditedFilesPanelProps {
  files: EditedFile[];
  isRTL?: boolean;
  maxVisible?: number;
  className?: string;
}

const truncateFileName = (name: string, maxLength: number = 22): string => {
  if (name.length <= maxLength) return name;
  
  const extension = name.includes('.') ? name.split('.').pop() : '';
  const baseName = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  
  if (baseName.length <= maxLength - 3 - (extension?.length || 0)) {
    return name;
  }
  
  const truncatedBase = baseName.slice(0, maxLength - 3 - (extension?.length || 0) - 1);
  return `${truncatedBase}...${extension ? `.${extension}` : ''}`;
};

const FileItem: React.FC<{ file: EditedFile; isRTL: boolean; index: number }> = ({ 
  file, 
  isRTL,
  index 
}) => {
  const statusLabel = isRTL 
    ? (file.status === 'editing' ? 'يعدل' : 'تم التعديل')
    : (file.status === 'editing' ? 'Editing' : 'Edited');
  
  const truncatedName = truncateFileName(file.fileName);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 dark:bg-zinc-800 text-xs ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${
        file.status === 'editing' ? 'text-primary animate-pulse' : 'text-zinc-400'
      }`} />
      
      <span className={`${
        file.status === 'editing' ? 'text-primary' : 'text-zinc-400'
      }`}>
        {statusLabel}
      </span>
      
      <span className="text-zinc-300 font-medium" title={file.fileName}>
        {truncatedName}
      </span>
    </motion.div>
  );
};

export const EditedFilesPanel: React.FC<EditedFilesPanelProps> = ({
  files,
  isRTL = false,
  maxVisible = 4,
  className = ''
}) => {
  const [showAll, setShowAll] = useState(false);

  if (files.length === 0) {
    return null;
  }

  const visibleFiles = showAll ? files : files.slice(0, maxVisible);
  const hasMore = files.length > maxVisible;

  const toggleLabel = isRTL 
    ? (showAll ? 'إخفاء' : 'عرض الكل')
    : (showAll ? 'Hide' : 'Show all');

  return (
    <div className={`${className}`}>
      <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <AnimatePresence mode="popLayout">
          {visibleFiles.map((file, index) => (
            <FileItem 
              key={file.id} 
              file={file} 
              isRTL={isRTL}
              index={index}
            />
          ))}
        </AnimatePresence>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="h-7 px-2 text-xs text-zinc-400 hover:text-foreground"
          >
            {toggleLabel}
            {showAll ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
};

export default EditedFilesPanel;
