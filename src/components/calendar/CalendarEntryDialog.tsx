
import React, { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarEntry, EntryType } from "@/utils/calendarUtils";
import { format } from "date-fns";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";

interface CalendarEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: CalendarEntry | Omit<CalendarEntry, 'id'>) => void;
  onDelete?: (entryId: string) => void;
  initialDate: Date;
  entry: CalendarEntry | null;
}

export const CalendarEntryDialog: React.FC<CalendarEntryDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialDate,
  entry
}) => {
  const { language } = useTheme();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date | undefined>(initialDate);
  const [error, setError] = useState<string | null>(null);
  
  // Reset form when dialog opens or entry changes
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setTitle(entry.title);
        setDescription(entry.description || "");
        setDate(new Date(entry.date));
      } else {
        setTitle("");
        setDescription("");
        setDate(initialDate);
      }
      setError(null);
    }
  }, [isOpen, entry, initialDate]);
  
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
      date: date.toISOString(),
      type: EntryType.MANUAL_NOTE,
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {entry ? t("editNote", language) : t("createNote", language)}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
              onChange={(e) => setTitle(e.target.value)}
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
                onSelect={setDate}
                className="pointer-events-auto"
                initialFocus
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              {t("description", language)}
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder", language)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row sm:justify-between gap-2">
          <div className="flex gap-2">
            {entry && onDelete && (
              <Button variant="destructive" onClick={handleDelete}>
                {t("delete", language)}
              </Button>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              {t("cancel", language)}
            </Button>
            <Button onClick={handleSave}>
              {t("save", language)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
