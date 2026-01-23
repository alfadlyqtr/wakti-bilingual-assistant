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
  Heart,
  NotebookPen,
  Smartphone
} from "lucide-react";
import { DrawerClose } from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { JournalService, JournalCheckin, JournalDay } from "@/services/journalService";
import { format as fmt } from "date-fns";

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
  const [journalDay, setJournalDay] = useState<any | null>(null);
  const [journalCheckins, setJournalCheckins] = useState<JournalCheckin[]>([]);
  // inline journal card removed in favor of navigating to full Timeline view
  
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
  const journals = dayEntries.filter(entry => entry.type === EntryType.JOURNAL);
  const phoneEvents = dayEntries.filter(entry => entry.type === EntryType.PHONE_CALENDAR);
  
  console.log('CalendarAgenda - Grouped entries:', {
    events: events.length,
    maw3dEvents: maw3dEvents.length,
    notes: notes.length,
    tasks: tasks.length,
    reminders: reminders.length,
    journals: journals.length,
    phoneEvents: phoneEvents.length
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
      case EntryType.JOURNAL:
        return <NotebookPen className="h-4 w-4 text-sky-500" />;
      case EntryType.PHONE_CALENDAR:
        return <Smartphone className="h-4 w-4 text-black dark:text-white" />;
      default:
        return <PinIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const locale = language === 'ar' ? 'ar-SA' : 'en-US';

  // Render note lines as pills (mirrors TimelineTab behavior)
  const renderNotePills = (text?: string | null) => {
    if (!text) return null;
    const lines = (text || '').split('\n');
    return (
      <div className="mt-2">
        {lines.map((rawLine, idx) => {
          const i = rawLine.indexOf('|');
          if (i < 0) return <div key={`note-line-${idx}`} className="text-sm">{rawLine}</div>;
          const before = rawLine.slice(0, i);
          const after = rawLine.slice(i);
          const parts = after.split('|').map(s => s.trim());
          const markerRe = /^__FREE__(.*)__END__$/;
          let noteFreeText = '';
          const tokensRaw: string[] = [];
          for (const p of parts) {
            if (!p) continue;
            const m = p.match(markerRe);
            if (m) { noteFreeText = m[1]; continue; }
            if (p === '🕒' || p === '__UNSAVED__') continue;
            tokensRaw.push(p);
          }
          const tokens = Array.from(new Set(tokensRaw));
          return (
            <div key={`pill-${idx}`} className="my-2 p-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 text-slate-800 shadow-sm">
              <span className="text-xs text-slate-600 mr-1">{before.match(/\[[^\]]+\]/)?.[0] || before}</span>
              <span className="sr-only"> | </span>
              <span className="inline-flex flex-wrap gap-2 align-middle">
                {tokens.map((tok, k) => (
                  <span key={`tok-${k}`} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{tok}</span>
                ))}
                {noteFreeText && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 px-2 py-0.5 shadow text-xs">{noteFreeText}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // When opening a Journal item, fetch that day's details
  React.useEffect(() => {
    (async () => {
      if (!selectedEntry || selectedEntry.type !== EntryType.JOURNAL) {
        setJournalDay(null);
        setJournalCheckins([]);
        return;
      }
      const dayStr = (selectedEntry.date || fmt(date, 'yyyy-MM-dd')).split('T')[0];
      try {
        const d = await JournalService.getDay(dayStr);
        setJournalDay(d || null);
        const checks = await JournalService.getCheckinsForDay(dayStr);
        setJournalCheckins(checks || []);
      } catch {
        setJournalDay(null);
        setJournalCheckins([]);
      }
    })();
  }, [selectedEntry, date]);
  
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

          {/* Journal section */}
          {journals.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <NotebookPen className="h-4 w-4 text-sky-500" />
                Journal ({journals.length})
              </h3>
              <div className="space-y-1">
                {journals.sort(sortEntries).map(j => (
                  <CompactAgendaItem
                    key={j.id}
                    entry={j}
                    onClick={() => {
                      const dayStr = format(date, 'yyyy-MM-dd');
                      onClose();
                      navigate(`/journal?date=${dayStr}&tab=timeline`);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Phone Calendar Events section */}
          {phoneEvents.length > 0 && (
            <div>
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-black dark:text-white" />
                {language === 'ar' ? 'أحداث الهاتف' : 'Phone Events'} ({phoneEvents.length})
              </h3>
              <div className="space-y-1">
                {phoneEvents.sort(sortEntries).map(event => (
                  <CompactAgendaItem 
                    key={event.id}
                    entry={event}
                    onClick={() => setSelectedEntry(event)}
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
      case EntryType.JOURNAL:
        return "border-l-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/20";
      case EntryType.PHONE_CALENDAR:
        return "border-l-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/30";
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
      case EntryType.JOURNAL:
        return <NotebookPen className="h-4 w-4 text-sky-500" />;
      case EntryType.PHONE_CALENDAR:
        return <Smartphone className="h-4 w-4 text-black dark:text-white" />;
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
          {entry.isAllDay && entry.type !== EntryType.JOURNAL && (
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
