
import React from "react";
import { Button } from "@/components/ui/button";
import { Clock, X } from "lucide-react";
import { formatRecordingTime } from "@/utils/audioUtils";
import { useTheme } from "@/providers/ThemeProvider";

export interface Highlight {
  timestamp: number;
  label?: string;
}

interface HighlightedTimestampsProps {
  highlights: Highlight[];
  onRemove?: (index: number) => void;
  recordingTime?: number;
  onAddHighlight?: () => void;
  isRecording?: boolean;
}

export default function HighlightedTimestamps({
  highlights,
  onRemove,
  recordingTime,
  onAddHighlight,
  isRecording = false,
}: HighlightedTimestampsProps) {
  const { language } = useTheme();
  
  return (
    <div className="space-y-2">
      {isRecording && recordingTime !== undefined && (
        <div className="flex items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddHighlight}
            className="flex items-center gap-1 border-dashed"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>
              {language === 'ar'
                ? 'تمييز هذه اللحظة'
                : 'Highlight this moment'} ({formatRecordingTime(recordingTime)})
            </span>
          </Button>
        </div>
      )}
      
      {highlights.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-xs text-muted-foreground">
            {language === 'ar' ? 'لحظات مميزة' : 'Highlighted moments'}:
          </div>
          <div className="flex flex-wrap gap-2">
            {highlights.map((highlight, index) => (
              <div
                key={index}
                className="flex items-center gap-1 bg-primary/10 text-xs py-1 px-2 rounded-full"
              >
                <Clock className="h-3 w-3" />
                <span>{formatRecordingTime(highlight.timestamp)}</span>
                {onRemove && (
                  <button
                    onClick={() => onRemove(index)}
                    className="ml-1 hover:text-destructive"
                    aria-label={
                      language === 'ar' ? 'إزالة التمييز' : 'Remove highlight'
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
