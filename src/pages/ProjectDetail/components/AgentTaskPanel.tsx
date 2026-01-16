import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileCode,
  Search,
  Wrench,
  CheckCheck
} from 'lucide-react';

export interface AgentStep {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  tool?: string;
  result?: string;
  duration?: number;
}

interface AgentTaskPanelProps {
  steps: AgentStep[];
  isActive: boolean;
  currentGoal?: string;
  isRTL?: boolean;
  onCancel?: () => void;
  className?: string;
}

const STEP_ICONS: Record<string, React.ElementType> = {
  read_file: FileCode,
  search_replace: Wrench,
  insert_code: Wrench,
  write_file: FileCode,
  list_files: Search,
  task_complete: CheckCheck,
  default: Sparkles,
};

const STATUS_COLORS = {
  pending: 'text-zinc-400 dark:text-zinc-500',
  in_progress: 'text-indigo-500',
  completed: 'text-emerald-500',
  failed: 'text-red-500',
};

const STATUS_BG = {
  pending: 'bg-zinc-100 dark:bg-zinc-800',
  in_progress: 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
  completed: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  failed: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
};

function StepIcon({ status, tool }: { status: AgentStep['status']; tool?: string }) {
  if (status === 'in_progress') {
    return <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />;
  }
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (status === 'failed') {
    return <XCircle className="h-4 w-4 text-red-500" />;
  }
  
  const Icon = STEP_ICONS[tool || 'default'] || STEP_ICONS.default;
  return <Icon className="h-4 w-4 text-zinc-400" />;
}

export function AgentTaskPanel({
  steps,
  isActive,
  currentGoal,
  isRTL = false,
  onCancel,
  className,
}: AgentTaskPanelProps) {
  const [isExpanded, setIsExpanded] = React.useState(true);
  
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  if (!isActive && steps.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        "bg-white dark:bg-zinc-900",
        "border-zinc-200 dark:border-zinc-800",
        "shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-indigo-500/20">
            <Sparkles className="h-4 w-4 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
              {isRTL ? 'وضع الوكيل' : 'Agent Mode'}
            </h3>
            {currentGoal && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">
                {currentGoal}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>{completedSteps}/{totalSteps}</span>
            <div className="w-16 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-indigo-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </div>

      {/* Steps */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto">
              {steps.map((step, index) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-start gap-3 p-2.5 rounded-lg border transition-all",
                    STATUS_BG[step.status]
                  )}
                >
                  {/* Step number + icon */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <span className={cn(
                      "text-xs font-mono",
                      STATUS_COLORS[step.status]
                    )}>
                      {index + 1}.
                    </span>
                    <StepIcon status={step.status} tool={step.tool} />
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      step.status === 'completed' && "text-emerald-700 dark:text-emerald-400",
                      step.status === 'in_progress' && "text-indigo-700 dark:text-indigo-400",
                      step.status === 'pending' && "text-zinc-600 dark:text-zinc-400",
                      step.status === 'failed' && "text-red-700 dark:text-red-400"
                    )}>
                      {step.title}
                    </p>
                    
                    {step.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {step.description}
                      </p>
                    )}
                    
                    {step.result && step.status === 'completed' && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                        ✓ {step.result}
                      </p>
                    )}
                    
                    {step.duration && step.status === 'completed' && (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {step.duration}ms
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
              
              {/* Active indicator */}
              {isActive && steps.every(s => s.status !== 'in_progress') && (
                <div className="flex items-center gap-2 p-2 text-xs text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {isRTL ? 'جاري التفكير...' : 'Thinking...'}
                </div>
              )}
            </div>
            
            {/* Cancel button */}
            {isActive && onCancel && (
              <div className="px-3 pb-3">
                <button
                  onClick={onCancel}
                  className="w-full py-1.5 text-xs text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Simpler inline version for chat messages
interface AgentStepsInlineProps {
  steps: AgentStep[];
  isRTL?: boolean;
}

export function AgentStepsInline({ steps, isRTL }: AgentStepsInlineProps) {
  if (steps.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {steps.map((step, i) => (
        <span
          key={step.id}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
            step.status === 'completed' && "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
            step.status === 'in_progress' && "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400",
            step.status === 'pending' && "bg-zinc-100 dark:bg-zinc-800 text-zinc-500",
            step.status === 'failed' && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
          )}
        >
          <StepIcon status={step.status} tool={step.tool} />
          {step.title}
        </span>
      ))}
    </div>
  );
}
