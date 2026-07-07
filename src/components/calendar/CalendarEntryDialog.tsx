import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarEntry, EntryType } from "@/utils/calendarUtils";
import { format, parse } from "date-fns";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface CalendarEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: CalendarEntry | Omit<CalendarEntry, 'id'>) => void;
  onDelete?: (entryId: string) => void;
  initialDate: Date;
  entry: CalendarEntry | null;
  prefill?: Partial<CalendarEntry> | null;
}

export const CalendarEntryDialog: React.FC<CalendarEntryDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  entry,
  prefill
}) => {
  const { language } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // Reset form when dialog opens or entry changes
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setTitle(prefill?.title ?? entry.title);
        setDescription(prefill?.description ?? (entry.description || ""));
        setTime(prefill?.time ?? (entry.time || ""));
        // Manual notes now store date as 'yyyy-MM-dd' (local day).
        // Parse safely to avoid UTC shifting the day.
        try {
          const parsed = parse(prefill?.date ?? entry.date, 'yyyy-MM-dd', new Date());
          setDate(parsed);
        } catch {
          // Fallback for legacy ISO entries
          setDate(new Date(prefill?.date ?? entry.date));
        }
      } else {
        setTitle(prefill?.title || "");
        setDescription(prefill?.description || "");
        setTime(prefill?.time || "");
        if (prefill?.date) {
          try {
            setDate(parse(prefill.date, 'yyyy-MM-dd', new Date()));
          } catch {
            setDate(initialDate);
          }
        } else {
          setDate(initialDate);
        }
      }
      setError(null);
    }
  }, [isOpen, entry, initialDate, prefill]);
  
  const handleSave = () => {
    // Validate form
    if (!title.trim()) {
      setError(t("titleRequired", language));
      return;
    }
    
    if (!date) {
      setError(t("dateRequired", language));
      return;
    }
    // Create entry object
    const entryData = {
      ...(entry ? { id: entry.id } : {}),
      title: title.trim(),
      description: description.trim() || undefined,
      // Store as local day string to prevent timezone shifting one day back
      date: format(date, 'yyyy-MM-dd'),
      time: time || undefined,
      type: EntryType.MANUAL_NOTE,
      isAllDay: !time,
    };
    onSave(entryData);
  };
  
  const handleDelete = () => {
    if (entry && onDelete) {
      onDelete(entry.id);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[450px] flex-col gap-0 overflow-hidden p-0 sm:w-full">
        <DialogHeader className="border-b px-4 pb-3 pt-4">
          <DialogTitle>
            {entry ? t("editNote", language) : t("createNote", language)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {error && (
            <div className="text-sm font-medium text-destructive">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label htmlFor="title" className="text-sm font-medium">
              {t("title", language)} *
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("titlePlaceholder", language)}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("date", language)} *
            </label>
            <div className="border rounded-md">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(nextDate) => {
                  setDate(nextDate);
                  if (nextDate) setError(null);
                }}
                className="pointer-events-auto"
                initialFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="time" className="text-sm font-medium">
              {language === 'ar' ? 'الوقت' : 'Time'}
            </label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                if (error) setError(null);
              }}
              className="w-full"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {t("description", language)}
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              placeholder={t("descriptionPlaceholder", language)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2 border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 sm:justify-between">
          <div className="flex gap-2 sm:flex-1">
            {entry && onDelete && (
              <Button type="button" variant="destructive" onClick={handleDelete}>
                {t("delete", language)}
              </Button>
            )}
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              {t("cancel", language)}
            </Button>
            <Button type="button" onClick={handleSave} className="flex-1 sm:flex-none">
              {t("save", language)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
