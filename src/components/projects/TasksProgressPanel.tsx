import React from 'react';
import { Check, Loader2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Task {
  id: string;
  label: string;
  labelAr?: string;
  status: 'pending' | 'loading' | 'completed';
}

interface TasksProgressPanelProps {
  tasks: Task[];
  isRTL?: boolean;
  className?: string;
}

const TaskItem: React.FC<{ task: Task; isRTL: boolean; index: number }> = ({ 
  task, 
  isRTL,
  index 
}) => {
  const label = isRTL && task.labelAr ? task.labelAr : task.label;

  return (
    <motion.div
      initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`flex items-center gap-3 py-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {task.status === 'loading' && (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        )}
        {task.status === 'pending' && (
          <Circle className="h-4 w-4 text-zinc-500" />
        )}
        {task.status === 'completed' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </div>
          </motion.div>
        )}
      </div>

      {/* Task Label */}
      <span className={`text-sm ${
        task.status === 'completed' 
          ? 'text-zinc-400 line-through' 
          : task.status === 'loading'
            ? 'text-foreground'
            : 'text-zinc-400'
      }`}>
        {label}
      </span>
    </motion.div>
  );
};

export const TasksProgressPanel: React.FC<TasksProgressPanelProps> = ({
  tasks,
  isRTL = false,
  className = ''
}) => {
  if (tasks.length === 0) {
    return null;
  }

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const headerLabel = isRTL ? 'المهام' : 'Tasks';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-zinc-900 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-800 ${className}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h3 className="text-sm font-medium text-foreground">{headerLabel}</h3>
        <span className="text-xs text-zinc-500">
          {completedCount}/{tasks.length}
        </span>
      </div>

      {/* Tasks List */}
      <div className="space-y-0.5">
        <AnimatePresence mode="popLayout">
          {tasks.map((task, index) => (
            <TaskItem 
              key={task.id} 
              task={task} 
              isRTL={isRTL}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TasksProgressPanel;
