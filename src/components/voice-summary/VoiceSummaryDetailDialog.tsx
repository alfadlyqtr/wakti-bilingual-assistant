import React, { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTheme } from "@/providers/ThemeProvider";
import VoiceSummaryDetail from "./VoiceSummaryDetail";

interface VoiceSummaryDetailDialogProps {
  recordingId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceSummaryDetailDialog({
  recordingId,
  isOpen,
  onClose
}: VoiceSummaryDetailDialogProps) {
  const { language } = useTheme();
  const [localOpen, setLocalOpen] = useState(false);
  
  // Sync local state with props
  useEffect(() => {
    console.log('Dialog sync effect:', { isOpen, recordingId });
    if (isOpen && recordingId) {
      setLocalOpen(true);
    } else {
      // Add a small delay to allow transition animations
      const timer = setTimeout(() => {
        setLocalOpen(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, recordingId]);

  // For debugging
  useEffect(() => {
    console.log('Local open state changed:', localOpen);
  }, [localOpen]);
  
  const handleOpenChange = (open: boolean) => {
    console.log('Dialog open change:', open);
    if (!open) {
      onClose();
    }
    setLocalOpen(open);
  };
  
  return (
    <Dialog open={localOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        {localOpen && recordingId && (
          <VoiceSummaryDetail />
        )}
      </DialogContent>
    </Dialog>
  );
}
