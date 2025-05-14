
import React from 'react';
import { format, isPast, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import { Reminder, RecurrencePattern } from '@/contexts/TaskReminderContext';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarClock, Edit, Trash } from 'lucide-react';
import { useTheme } from '@/providers/ThemeProvider';
import { t } from '@/utils/translations';

interface ReminderItemProps {
  reminder: Reminder;
  onEdit: (reminder: Reminder) => void;
  onDelete: (id: string) => void;
}

const ReminderItem: React.FC<ReminderItemProps> = ({ reminder, onEdit, onDelete }) => {
  const { language } = useTheme();
  
  const isReminderOverdue = isPast(new Date(reminder.due_date));
  const isReminderToday = isToday(new Date(reminder.due_date));

  // Helper function to convert RecurrencePattern to TranslationKey
  const getRecurrenceTranslationKey = (pattern: RecurrencePattern): string => {
    // Using the pattern directly as it's now added to TranslationKey
    return pattern;
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`p-4 mb-3 rounded-lg border ${
        isReminderOverdue 
          ? 'border-red-500 bg-red-100/30 dark:bg-red-950/30'
          : isReminderToday
          ? 'border-blue-500 bg-blue-100/30 dark:bg-blue-950/30' 
          : 'border-gray-200 dark:border-gray-700 bg-card'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-medium">
            {reminder.title}
          </h3>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Due date badge */}
            <Badge variant={isReminderOverdue ? "destructive" : isReminderToday ? "secondary" : "outline"} className="flex gap-1 items-center">
              <CalendarClock className="h-3 w-3" />
              <span>{format(new Date(reminder.due_date), 'MMM d, yyyy h:mm a')}</span>
            </Badge>
            
            {/* Recurrence badge */}
            {reminder.is_recurring && reminder.recurrence_pattern && (
              <Badge variant="outline" className="flex gap-1 items-center">
                <Clock className="h-3 w-3" />
                {t(getRecurrenceTranslationKey(reminder.recurrence_pattern), language)}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onEdit(reminder)}
            className="p-1.5 rounded-full bg-background/80 text-muted-foreground hover:text-primary hover:bg-background"
          >
            <Edit className="h-4 w-4" />
          </button>
          
          <button
            onClick={() => onDelete(reminder.id)}
            className="p-1.5 rounded-full bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background"
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ReminderItem;
