
import React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useTheme } from "@/providers/ThemeProvider";
import { t } from "@/utils/translations";
import { CalendarEntry, EntryType } from "@/utils/calendarUtils";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  CheckSquare,
  Calendar as CalendarIcon,
  Bell,
  PinIcon
} from "lucide-react";
import { DrawerClose } from "@/components/ui/drawer";

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
  
  // Filter entries for the selected date
  const dayEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.toDateString() === date.toDateString();
  });
  
  // Group entries by type
  const tasks = dayEntries.filter(entry => entry.type === EntryType.TASK);
  const events = dayEntries.filter(entry => entry.type === EntryType.EVENT);
  const reminders = dayEntries.filter(entry => entry.type === EntryType.REMINDER);
  const notes = dayEntries.filter(entry => entry.type === EntryType.MANUAL_NOTE);
  
  // Sort function to order by priority and then alphabetically
  const sortEntries = (a: CalendarEntry, b: CalendarEntry) => {
    // Sort by priority if available
    if (a.priority && b.priority) {
      if (a.priority !== b.priority) {
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
    }
    
    // Then sort alphabetically
    return a.title.localeCompare(b.title);
  };
  
  // Helper function to render the icon for each entry type
  const renderIcon = (type: EntryType) => {
    switch (type) {
      case EntryType.TASK:
        return <CheckSquare className="h-5 w-5 text-green-500" />;
      case EntryType.EVENT:
        return <CalendarIcon className="h-5 w-5 text-blue-500" />;
      case EntryType.REMINDER:
        return <Bell className="h-5 w-5 text-red-500" />;
      case EntryType.MANUAL_NOTE:
        return <PinIcon className="h-5 w-5 text-yellow-500" />;
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
        <div className="space-y-6">
          {/* Tasks section */}
          {tasks.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-green-500" />
                {t("tasks", language)} ({tasks.length})
              </h3>
              <div className="space-y-2">
                {tasks.sort(sortEntries).map(task => (
                  <AgendaItem 
                    key={task.id}
                    entry={task}
                    onClick={() => {}}
                    colorClass="border-green-500"
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
              <div className="space-y-2">
                {events.sort(sortEntries).map(event => (
                  <AgendaItem 
                    key={event.id}
                    entry={event}
                    onClick={() => {}}
                    colorClass="border-blue-500"
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
                {t("reminders", language)} ({reminders.length})
              </h3>
              <div className="space-y-2">
                {reminders.sort(sortEntries).map(reminder => (
                  <AgendaItem 
                    key={reminder.id}
                    entry={reminder}
                    onClick={() => {}}
                    colorClass="border-red-500"
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
              <div className="space-y-2">
                {notes.sort(sortEntries).map(note => (
                  <AgendaItem 
                    key={note.id}
                    entry={note}
                    onClick={() => onEditEntry(note)}
                    colorClass="border-yellow-500"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Component for individual agenda items
interface AgendaItemProps {
  entry: CalendarEntry;
  onClick: () => void;
  colorClass: string;
}

const AgendaItem: React.FC<AgendaItemProps> = ({ entry, onClick, colorClass }) => {
  const icon = 
    entry.type === EntryType.TASK ? <CheckSquare className="h-5 w-5 text-green-500" /> :
    entry.type === EntryType.EVENT ? <CalendarIcon className="h-5 w-5 text-blue-500" /> :
    entry.type === EntryType.REMINDER ? <Bell className="h-5 w-5 text-red-500" /> :
    <PinIcon className="h-5 w-5 text-yellow-500" />;
  
  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`p-3 rounded-md border-l-4 ${colorClass} bg-card hover:bg-accent/10 cursor-pointer`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div className="flex-1">
          <div className="font-medium">{entry.title}</div>
          {entry.description && (
            <div className="text-sm text-muted-foreground line-clamp-2">
              {entry.description}
            </div>
          )}
          {entry.due && (
            <div className="text-xs text-muted-foreground mt-1">
              {format(new Date(entry.due), 'h:mm a')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
