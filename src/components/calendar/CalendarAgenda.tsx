import React, { useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { CalendarEntry, EntryType } from "@/utils/calendarUtils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  CheckSquare,
  Calendar as CalendarIcon,
  Bell,
  PinIcon,
  Heart
} from "lucide-react";
import { DrawerClose } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CalendarAgendaProps {
  date: Date;
  entries: CalendarEntry[];
  onClose: () => void;
  onEditEntry: (entry: CalendarEntry) => void;
}

export const CalendarAgenda: React.FC<CalendarAgendaProps> = ({
  date,
  entries,
  onClose,
  onEditEntry
}) => {
  const { language } = useTheme();
  const navigate = useNavigate();
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  
  console.log('CalendarAgenda - Selected date:', date);
  console.log('CalendarAgenda - All entries:', entries);
  
  // Filter entries for the selected date with better date matching
  const dayEntries = entries.filter(entry => {
    const entryDate = entry.date.split('T')[0]; // Get just the date part
    const selectedDate = format(date, 'yyyy-MM-dd');
    console.log(`Comparing entry date ${entryDate} with selected date ${selectedDate}`);
    return entryDate === selectedDate;
  });
  
  console.log('CalendarAgenda - Filtered day entries:', dayEntries);
  
  // Group entries by type
  const events = dayEntries.filter(entry => entry.type === EntryType.EVENT);
  const maw3dEvents = dayEntries.filter(entry => entry.type === EntryType.MAW3D_EVENT);
  const notes = dayEntries.filter(entry => entry.type === EntryType.MANUAL_NOTE);
  const tasks = dayEntries.filter(entry => entry.type === EntryType.TASK);
  const reminders = dayEntries.filter(entry => entry.type === EntryType.REMINDER);
  
  console.log('CalendarAgenda - Grouped entries:', {
    events: events.length,
    maw3dEvents: maw3dEvents.length,
    notes: notes.length,
    tasks: tasks.length,
    reminders: reminders.length
  });
  
  // Sort function to order alphabetically
  const sortEntries = (a: CalendarEntry, b: CalendarEntry) => {
    return a.title.localeCompare(b.title);
  };
  
  // Helper function to render the icon for each entry type
  const renderIcon = (type: EntryType) => {
    switch (type) {
      case EntryType.EVENT:
        return <CalendarIcon className="h-4 w-4 text-blue-500" />;
      case EntryType.MAW3D_EVENT:
        return <Heart className="h-4 w-4 text-purple-500" />;
      case EntryType.MANUAL_NOTE:
        return <PinIcon className="h-4 w-4 text-yellow-500" />;
      case EntryType.TASK:
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case EntryType.REMINDER:
        return <Bell className="h-4 w-4 text-red-500" />;
      default:
        return <PinIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const locale = language === 'ar' ? 'ar-SA' : 'en-US';
  
  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-semibold">
          {date.toLocaleDateString(locale, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        <DrawerClose asChild>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </DrawerClose>
      </div>
      
      {dayEntries.length === 0 ? (
        <div className="text-muted-foreground text-center py-8">
          {t("noEvents", language)}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tasks section */}
          {tasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-green-500" />
                Tasks ({tasks.length})
              </h3>
              <div className="space-y-1">
                {tasks.sort(sortEntries).map(task => (
                  <CompactAgendaItem 
                    key={task.id}
                    entry={task}
                    onClick={() => setSelectedEntry(task)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Reminders section */}
          {reminders.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                Reminders ({reminders.length})
              </h3>
              <div className="space-y-1">
                {reminders.sort(sortEntries).map(reminder => (
                  <CompactAgendaItem 
                    key={reminder.id}
                    entry={reminder}
                    onClick={() => setSelectedEntry(reminder)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Maw3d Events section */}
          {maw3dEvents.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Heart className="h-4 w-4 text-purple-500" />
                Maw3d Events ({maw3dEvents.length})
              </h3>
              <div className="space-y-1">
                {maw3dEvents.sort(sortEntries).map(event => (
                  <CompactAgendaItem 
                    key={event.id}
                    entry={event}
                    onClick={() => setSelectedEntry(event)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Events section */}
          {events.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-500" />
                {t("events", language)} ({events.length})
              </h3>
              <div className="space-y-1">
                {events.sort(sortEntries).map(event => (
                  <CompactAgendaItem 
                    key={event.id}
                    entry={event}
                    onClick={() => setSelectedEntry(event)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Manual Notes section */}
          {notes.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <PinIcon className="h-4 w-4 text-yellow-500" />
                {t("notesLabel", language)} ({notes.length})
              </h3>
              <div className="space-y-1">
                {notes.sort(sortEntries).map(note => (
                  <CompactAgendaItem 
                    key={note.id}
                    entry={note}
                    onClick={() => setSelectedEntry(note)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entry Details Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedEntry && renderIcon(selectedEntry.type)}
              {selectedEntry?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {selectedEntry?.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm">{selectedEntry.description}</p>
              </div>
            )}
            {selectedEntry?.time && !selectedEntry?.isAllDay && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Time</p>
                <p className="text-sm">{selectedEntry.time}</p>
              </div>
            )}
            {selectedEntry?.location && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="text-sm">📍 {selectedEntry.location}</p>
              </div>
            )}
            {selectedEntry?.isAllDay && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p className="text-sm">All Day</p>
              </div>
            )}
            {selectedEntry?.priority && (selectedEntry.type === EntryType.TASK) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Priority</p>
                <p className="text-sm capitalize">{selectedEntry.priority}</p>
              </div>
            )}
            {selectedEntry?.completed !== undefined && (selectedEntry.type === EntryType.TASK) && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <p className="text-sm">{selectedEntry.completed ? 'Completed' : 'Pending'}</p>
              </div>
            )}
            {selectedEntry?.type === EntryType.MANUAL_NOTE && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  onEditEntry(selectedEntry);
                  setSelectedEntry(null);
                }}
                className="w-full"
              >
                Edit Note
              </Button>
            )}
            {(selectedEntry?.type === EntryType.TASK || selectedEntry?.type === EntryType.REMINDER) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  navigate('/tr');
                }}
                className="w-full"
              >
                View in T&R
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Compact component for individual agenda items
interface CompactAgendaItemProps {
  entry: CalendarEntry;
  onClick: () => void;
}

const CompactAgendaItem: React.FC<CompactAgendaItemProps> = ({ entry, onClick }) => {
  const getColorClass = (type: EntryType) => {
    switch (type) {
      case EntryType.EVENT:
        return "border-l-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20";
      case EntryType.MAW3D_EVENT:
        return "border-l-purple-500 hover:bg-purple-50 dark:hover:bg-purple-950/20";
      case EntryType.MANUAL_NOTE:
        return "border-l-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-950/20";
      case EntryType.TASK:
        return "border-l-green-500 hover:bg-green-50 dark:hover:bg-green-950/20";
      case EntryType.REMINDER:
        return "border-l-red-500 hover:bg-red-50 dark:hover:bg-red-950/20";
      default:
        return "border-l-gray-500 hover:bg-gray-50 dark:hover:bg-gray-950/20";
    }
  };

  const renderIcon = (type: EntryType) => {
    switch (type) {
      case EntryType.EVENT:
        return <CalendarIcon className="h-4 w-4 text-blue-500" />;
      case EntryType.MAW3D_EVENT:
        return <Heart className="h-4 w-4 text-purple-500" />;
      case EntryType.MANUAL_NOTE:
        return <PinIcon className="h-4 w-4 text-yellow-500" />;
      case EntryType.TASK:
        return <CheckSquare className="h-4 w-4 text-green-500" />;
      case EntryType.REMINDER:
        return <Bell className="h-4 w-4 text-red-500" />;
      default:
        return <PinIcon className="h-4 w-4 text-gray-500" />;
    }
  };
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-2 rounded-md border-l-4 bg-card cursor-pointer transition-colors ${getColorClass(entry.type)}`}
    >
      <div className="flex items-center gap-2">
        {renderIcon(entry.type)}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{entry.title}</div>
          {entry.time && !entry.isAllDay && (
            <div className="text-xs text-muted-foreground">{entry.time}</div>
          )}
          {entry.isAllDay && (
            <div className="text-xs text-muted-foreground">All Day</div>
          )}
          {entry.completed !== undefined && entry.type === EntryType.TASK && (
            <div className="text-xs text-muted-foreground">
              {entry.completed ? '✓ Completed' : '○ Pending'}
            </div>
          )}
          {entry.priority && entry.type === EntryType.TASK && entry.priority !== 'normal' && (
            <div className="text-xs text-muted-foreground capitalize">
              {entry.priority} priority
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CalendarAgenda;
